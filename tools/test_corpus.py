"""Regression checks for source fidelity and relationship-aware semantic layers.

Run: python -m unittest discover -s tools -p test_corpus.py
Set PROMPT_CORPUS_SOURCE to run the complete 17-page archive check elsewhere.
"""
import os
from pathlib import Path
import unittest

import extract_corpus_library as corpus
from corpus_grammar import annotate, classify


class SourceParsingTests(unittest.TestCase):
    def test_weights_quotes_and_emoticons(self):
        units = list(corpus.split_tag_units('1.4::lace skirt, pink ribbon::, (soft light:1.2), text "Hello, CHERRY", :3, ;)'))
        self.assertEqual(units, [
            ("lace skirt", "1.4"), ("pink ribbon", "1.4"),
            ("soft light", "1.2"), ('text "Hello, CHERRY"', None),
            (":3", None), (";)", None),
        ])
        self.assertEqual(corpus.normalize_tag('Large Title Text “CHERRY”'), 'large title text "CHERRY"')
        self.assertEqual(corpus.normalize_tag(";)"), ";)")
        self.assertEqual(corpus.normalize_tag("heart (symbol)"), "heart (symbol)")

    def test_adjacent_weight_groups(self):
        self.assertEqual(list(corpus.split_tag_units('(blue sky:1.2) (white clouds:1.1)')),
                         [("blue sky", "1.2"), ("white clouds", "1.1")])

    def test_all_original_pages_and_variants(self):
        source = Path(os.environ.get("PROMPT_CORPUS_SOURCE", r"C:\Codex\Image Prompt"))
        if not source.is_dir():
            self.skipTest("Original HTML archive unavailable; set PROMPT_CORPUS_SOURCE")
        previous = corpus.SOURCE_DIR
        try:
            corpus.SOURCE_DIR = source
            occurrences, prompts, male_sections, filtered_tags = corpus.parse_pages()
        finally:
            corpus.SOURCE_DIR = previous
        library = annotate(corpus.build_library(occurrences, prompts, male_sections, filtered_tags))
        self.assertEqual(library["source"]["pages"], 17)
        self.assertEqual(len(prompts), 205)
        self.assertEqual(len(occurrences), 4961)
        self.assertEqual(library["stats"]["sourceOccurrences"], 4964)
        self.assertEqual(male_sections, 33)
        self.assertEqual(filtered_tags, 3)
        source_tags = [t for p in prompts.values() for s in p["sections"] for t in s["tags"]]
        self.assertEqual(sum(t["tag"] == ";)" for t in source_tags), 2)
        self.assertEqual(sum(bool(corpus.MALE_TAG_RE.search(t["tag"])) for t in source_tags), 3)
        self.assertFalse(any(corpus.MALE_TAG_RE.search(t["tag"]) for t in library["items"]))
        facets = {f["id"] for f in library["grammar"]["facets"]}
        for prompt in prompts.values():
            for section in prompt["sections"]:
                self.assertTrue(section["rawText"])
                for item in section["tags"]:
                    self.assertTrue(item["rawTag"])
                    self.assertIn(item["facet"], facets)
        cherry = [t for s in prompts["p17-08"]["sections"] for t in s["tags"]
                  if '"CHERRY"' in t["tag"]]
        self.assertEqual(len(cherry), 1)
        self.assertEqual(cherry[0]["facet"], "graphics")


class SemanticLayerTests(unittest.TestCase):
    def test_relationships_precede_incidental_nouns(self):
        examples = {
            "holding skirt": "hands", "holding top hat": "hands",
            "holding leg warmers": "hands", "holding hair ribbon": "hands",
            "holding a silver necklace": "hands", "sitting on giant macaron": "pose",
            "sitting on vintage monitor": "pose", "sitting on tall strawberry parfait glass": "pose",
            "arms around neck": "interaction", "looking at another": "interaction",
            "another peach in foreground": "floating", "clock hands": "floating",
            "hand-drawn stars": "graphics", "palm tree": "environment",
            "floating ribbons": "floating", "scattered pearl necklaces": "floating",
            "floating eyeshadow palette": "floating", "floating handbag": "floating",
            "floating holographic acrylic panels": "floating", "floating halo": "accessory",
            "floating computer windows": "layout", "floating menu buttons": "layout",
            "flying smartphone": "floating", "flying flowers": "floating",
            "flying hair": "motion", "long flying ribbons": "motion",
            "falling heart playing cards": "floating", "flowing brown hair": "motion",
            "butterfly bodice": "construction", "butterfly hair clips": "accessory",
            "giant butterfly wings": "accessory", "detachable puffy balloon sleeves": "construction",
            "top-right support card list": "layout", "top-left rounded character profile card": "layout",
            "portrait close-up panel at bottom right": "layout", "eye close-up inset": "layout",
            "lace frame border": "graphics", "looking through frame": "gaze",
            "feet-first low-angle perspective": "camera", "foreshortened legs": "camera",
            "focus on hands": "framing", "mid-shot to knee-shot": "framing",
            "central powerful glow from the bouquet and feet": "light",
            "soft glitter eyeshadow": "appearance", "heart sticker on cheek": "appearance",
            "round eyewear": "accessory", "eyepatch over one eye": "accessory",
            "phone case with flower pop socket": "prop", "black roses around neck": "accessory",
            "red ribbon wrist bindings": "accessory", "white roses on hat": "accessory",
            "glittering clear umbrella with star decorations held overhead": "hands",
        }
        for tag, expected in examples.items():
            with self.subTest(tag=tag):
                self.assertEqual(classify(tag, "other", "[ 배경 ]")[0], expected)

    def test_word_boundaries_and_inflections(self):
        examples = {
            "window": "environment", "stained glass windows": "environment",
            "wind": "motion", "windblown hair": "motion",
            "open oversized windbreaker": "outfit-base", "oversized windbreaker": "outfit-base",
            "intricate fabric textures": "fabric", "spandex fabric texture": "fabric",
            "black leggings": "legwear", "white kneehighs": "legwear",
            "knee-high dark socks": "legwear", "mismatched legwear": "legwear",
            "light blue baggy jeans": "outfit-base", "tailcoat": "outfit-base",
            "white ballgown": "outfit-base", "pleated miniskirt": "outfit-base",
            "light clothing": "outfit-base", "summer outfit": "outfit-base",
            "intricate steampunk clockwork": "environment", "rainbow": "palette",
            "colorful playroom": "environment", "pastel aesthetic": "aesthetic",
            "ms paint window": "layout", "warning window": "layout",
            "train window frame": "environment", "sunlight through window": "light",
            "lineart outline": "medium", "large stylized \"LEMON\" typography": "graphics",
            "heart (symbol)": "graphics", "heart motifs": "graphics",
            "sticker patches": "motif", "floral embroidery": "motif",
            "gorgeous blooming flowers": "floating", "light blue background": "environment",
            "light blue theme": "palette", "neon pink and blue palette": "palette",
            "hand close-up": "framing", "head tilted down": "pose",
            "blushing": "gaze", "smiling": "gaze", ";)": "gaze", ":3": "gaze",
        }
        for tag, expected in examples.items():
            with self.subTest(tag=tag):
                # The background label deliberately stresses semantic overrides.
                self.assertEqual(classify(tag, "other", "[ 배경 ]")[0], expected)


if __name__ == "__main__":
    unittest.main()
