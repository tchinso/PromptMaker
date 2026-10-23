#!/usr/bin/env python3
"""Build the browser-side prompt corpus library from the saved prompt pages.

Run with the bundled workspace Python (which includes lxml):

    python tools/extract_corpus_library.py

The current ``References/`` archive (or ``--source`` directory) is the source of
truth. All source variants, original section text, and phrases are preserved.
Male-character phrases are excluded only from the normal solo-female catalog;
explicit source selection still has access to the complete variant.

The generated JavaScript is deterministic so corpus changes remain reviewable
in source control.
"""

from __future__ import annotations

import json
import argparse
import re
from collections import Counter, defaultdict
from pathlib import Path

from lxml import html
from corpus_grammar import annotate, write_report


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "References"
OUTPUT_PATH = ROOT / "site" / "corpus-library.js"

LABEL_RE = re.compile(r"\[\s*[^\]]+\s*\]")
HANGUL_RE = re.compile(r"[가-힣]")
WEIGHT_PREFIX_RE = re.compile(r"^(\d+(?:\.\d+)?)\s*::\s*")
PAREN_WEIGHT_RE = re.compile(r"^\((.*)\s*:\s*(\d+(?:\.\d+)?)\)$")
MALE_LABEL_RE = re.compile(r"남캐|남자|남성")
MALE_TAG_RE = re.compile(r"\b(?:1boy|2boys|boy|boys|male|males|man|men|man's)\b", re.I)

CATEGORY_PRIORITY = [
    "expression",
    "action",
    "composition",
    "accessory",
    "outfit",
    "background",
    "other",
]

EXPRESSION_RE = re.compile(
    r"\b(?:expression|smile|smiling|smirk|smirking|wink|winking|blush|blushing|"
    r"flustered|embarrassed|bashful|pout|pouting|sad|melancholic|worried|worry|"
    r"surprised|cheerful|happy|joyful|peaceful|serene|serious|emotionless|"
    r"distressed (?:face|expression|look)|teary|crying|coy|drowsy|averted gaze|"
    r"sparkling eyes|dead eyes|shadowed eyes|eyes closed|closed eyes|open mouth|"
    r"closed mouth|close eyes|parted lips|gritted teeth|confident look|playful look|soft gaze|"
    r"downward gaze|gaze lowered)\b",
    re.I,
)

COMPOSITION_RE = re.compile(
    r"\b(?:solo|1girl|close[- ]?up|portrait|full body|upper body|lower body|"
    r"cowboy shot|medium shot|mid[- ]shot|waist[- ]up|knee shot|three-quarter shot|"
    r"wide shot|face shot|angle|view|perspective|composition|framing|frame|"
    r"foreground|background focus|focus on|centered|symmetrical|asymmetrical composition|"
    r"side profile|front view|rear view|back view|profile view|from above|from below|from behind|"
    r"top-down|overhead (?:shot|view)|eye-level|looking at viewer|looking at another|looking back|"
    r"looking up at viewer|looking down|eye contact|foreshortening|depth of field|"
    r"bokeh|lens flare|motion blur|soft focus|tilted camera|dutch angle|low angle|"
    r"high angle|dynamic angle|dramatic angle|cinematic framing|multiple views|"
    r"character sheet|reference sheet|panel layout|three-panel|split screen|collage|"
    r"close distance|balanced positioning|2people|2girls)\b",
    re.I,
)

ACTION_RE = re.compile(
    r"\b(?:pose|posture|stance|holding|carrying|gripping|wielding|hugging|kissing|"
    r"touching|aiming|pointing|bracing|clasping|praying|sitting|seated|standing|"
    r"kneeling|lying|leaning|crouching|squatting|jumping|running|sprinting|walking|"
    r"dancing|twirling|floating|flying|riding|skating|eating|drinking|reading|held|"
    r"playing|sleeping|resting|arching|bending|bent|raised|crossed|mid-air|mid-stride|"
    r"one knee|cross-legged|hands? near|hands? on|hands? forming|hands? up|arms? raised|"
    r"arms? crossed|arms? outstretched|arms? up|arms? around|legs? up|dangling legs|"
    r"one leg up|reaching out|singing|blowing bubblegum|brushing teeth|chin rest|"
    r"clasped hands|head tilt|tilting head|body contact|wind-blown hair|windblown hair|"
    r"flowing hair|blowing hair|adjusting|receiving kiss|making a heart)\b",
    re.I,
)

OUTFIT_RE = re.compile(
    r"\b(?:outfit|attire|fashion|dress|gown|skirt|shirt|t-shirt|blouse|jacket|coat|"
    r"hoodie|hood up|sweater|cardigan|pants|trousers|shorts|miniskirt|stockings|"
    r"thighhighs?|thigh-highs?|"
    r"socks|shoes|boots|sneakers|slippers|heels|bodysuit|bikini|swimsuit|uniform|suit|vest|"
    r"apron|(?:crop|tank|halter|tube|bikini|ruffled|frilled|knit|sleeveless|"
    r"off-shoulder|fitted|layered|lace) top|camisole|bodice|corset|petticoat|"
    r"kimono|yukata|jinbei|hanbok|"
    r"qipao|cheongsam|lolita|maid|nun dress|pajamas|sleepwear|track jacket|windbreaker|"
    r"jersey|techwear|streetwear|schoolwear|formalwear|sleeves?|collar|neckline|"
    r"fabric|denim|leather|velvet|silk|satin|sheer|lace trim|frills?|ruffles?|pleated|"
    r"layered clothing|off-shoulder|bare shoulders|backless|buttoned|unbuttoned|"
    r"double-breasted|oversized clothing)\b",
    re.I,
)

ACCESSORY_RE = re.compile(
    r"\b(?:accessor|ornament|jewelry|choker|necklace|earrings?|bracelets?|rings?|"
    r"brooch|belt|buckles?|straps?|harness|gloves?|headband|hair clips?|hair bows?|"
    r"hair ribbons?|hair ornament|ribbon|bow tie|necktie|tie|hat|cap|bonnet|veil|"
    r"tiara|crown|halo|wings?|animal ears|cat ears|fox ears|bunny ears|horse ears|"
    r"tail|horns?|goggles|glasses|eyewear|headphones|mask|garter|rosary|bag|purse|"
    r"ita bag|backpack|parasol|umbrella|microphone|guitar|gun|knife|scythe|baseball bat|"
    r"controller|whisk|fork|spoon|plushie|stuffed toy|bottle|telephone|phone|camera|"
    r"book|bouquet|lightstick|wand|helmet|sign|tray|lollipop|popsicle|ice cream cone|"
    r"skateboard|racket|paintbrush|scroll|envelope|love letter|pillow|nail polish|"
    r"holster|bandaid|badge|chain)\b",
    re.I,
)

BACKGROUND_RE = re.compile(
    r"\b(?:background|backdrop|environment|interior|outdoors|indoors|room|bedroom|"
    r"classroom|library|cafe|shop|diner|clinic|cathedral|chapel|church|palace|garden|"
    r"terrace|rooftop|"
    r"forest|street|city|cityscape|metropolis|park|beach|seaside|ocean|sea|underwater|"
    r"bathroom|wall|buildings?|bushes|fence|ground|floor|surface|door|gate|plaza|venue|"
    r"cabin|carousel|mirror|equipment|posters?|banners?|crowd|props?|objects?|racks?|"
    r"pool|sky|clouds?|starfield|night|day|morning|evening|sunset|sunrise|weather|"
    r"rain|raining|snow|sunlight|moonlight|daylight|lighting|light rays?|backlight|"
    r"spotlight|shadows?|glow|glowing|luminous|illumination|mist|fog|smoke|steam|"
    r"particles?|sparkles?|glitter|confetti|petals?|hearts?|stars?|balloons?|stickers?|"
    r"graffiti|holograms?|fireworks|neon|pastel background|simple background|"
    r"white background|dark background|gradient backdrop|atmosphere|aura|bloom|"
    r"vibrant colors|pastel colors|color palette|monochrome|grayscale|racetrack|road|"
    r"stage|concert|stadium|arcade|train|window|architecture|ruins|furniture|plushies|"
    r"stuffed toys)\b",
    re.I,
)


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def page_number(path: Path) -> int:
    match = re.search(r"(\d+)$", path.stem)
    if not match:
        raise ValueError(f"Cannot determine page number from {path.name}")
    return int(match.group(1))


def content_with_markers(node) -> str:
    """Render text while replacing complete bold section labels with markers."""

    output: list[str] = []

    def visit(current) -> None:
        if current.tag == "br":
            output.append(" ")
        if current.text:
            output.append(current.text)
        for child in current:
            bold_text = normalize_space(child.text_content()) if child.tag == "b" else ""
            if child.tag == "b" and LABEL_RE.fullmatch(bold_text):
                output.append(f"\n@@{bold_text}@@\n")
            else:
                visit(child)
            if child.tail:
                output.append(child.tail)

    visit(node)
    return "".join(output)


def split_sections(raw: str) -> list[tuple[str, str]]:
    # Prompt11 has one label split across two adjacent bold elements. Once text is
    # flattened it is a plain bracket label, so convert it to the same marker form.
    raw = re.sub(
        r"(?<!@@)(\[\s*[^\]\n]{1,40}\s*\])(?!@@)",
        lambda match: f"\n@@{normalize_space(match.group(1))}@@\n",
        raw,
    )
    pieces = re.split(r"\n@@(\[[^\]]+\])@@\n", raw)
    sections: list[tuple[str, str]] = []
    if pieces and normalize_space(pieces[0]):
        sections.append(("[ unlabelled ]", normalize_space(pieces[0])))
    for index in range(1, len(pieces), 2):
        sections.append((normalize_space(pieces[index]), normalize_space(pieces[index + 1])))
    return sections


def parse_pages() -> tuple[list[dict], dict[str, dict], int, int]:
    occurrences: list[dict] = []
    source_prompts: dict[str, dict] = {}
    excluded_male_sections = 0
    excluded_male_character_tags = 0

    paths = sorted(SOURCE_DIR.glob("Prompt*.html"), key=page_number)
    if not paths:
        raise ValueError(f"No Prompt*.html pages found in {SOURCE_DIR}")
    for path in paths:
        page_id = page_number(path)
        document = html.fromstring(path.read_text(encoding="utf-8"))
        containers = document.xpath("//main//article//article/div")
        if not containers:
            raise ValueError(f"Prompt container not found in {path}")
        children = list(containers[0])
        prompt_heads = [
            index
            for index, child in enumerate(children)
            if child.tag == "blockquote"
        ][1:]

        for prompt_index, start in enumerate(prompt_heads, start=1):
            end = prompt_heads[prompt_index] if prompt_index < len(prompt_heads) else len(children)
            prompt_id = f"p{page_id:02d}-{prompt_index:02d}"
            title = normalize_space(children[start].text_content()).removeprefix("🍑 ")
            source_prompts[prompt_id] = {
                "pageId": page_id,
                "promptId": prompt_index,
                "title": title,
                "file": path.name,
                "sections": [],
            }

            raw = "\n".join(
                content_with_markers(element)
                for element in children[start + 1 : end]
                if element.tag not in {"figure", "blockquote"}
            )
            for label, text in split_sections(raw):
                source_section = {"label": label, "rawText": text, "tags": []}
                source_prompts[prompt_id]["sections"].append(source_section)
                is_male_variant = bool(MALE_LABEL_RE.search(label))
                if is_male_variant:
                    excluded_male_sections += 1
                for tag, observed_weight in split_tag_units(text):
                    normalized = normalize_tag(tag)
                    if not normalized:
                        continue
                    source_section["tags"].append({
                        "tag": normalized,
                        "rawTag": normalize_space(tag),
                        "weight": observed_weight,
                        "category": infer_category(normalized, section_hint(label)),
                    })
                    # Keep the full source variant available for explicit selection.
                    # Only the general-purpose catalog applies the solo-female filter.
                    if MALE_TAG_RE.search(normalized):
                        excluded_male_character_tags += 1
                        continue
                    occurrences.append(
                        {
                            "tag": normalized,
                            "weight": observed_weight,
                            "pageId": page_id,
                            "promptId": prompt_id,
                            "label": label,
                            "category": infer_category(normalized, section_hint(label)),
                        }
                    )

    return occurrences, source_prompts, excluded_male_sections, excluded_male_character_tags


def split_tag_units(text: str):
    active_weight: str | None = None
    # A comma in quoted typography is literal text, not a tag separator.
    for raw_unit in re.split(r',(?=(?:[^"“”]*["“][^"“”]*["”])*[^"“”]*$)', text):
        unit = normalize_space(raw_unit)
        if not unit:
            continue

        prefix = WEIGHT_PREFIX_RE.match(unit)
        if prefix:
            active_weight = prefix.group(1)
            unit = unit[prefix.end() :]

        closes_weight = unit.rstrip().endswith("::")
        if closes_weight:
            unit = re.sub(r"\s*::\s*$", "", unit)

        unit = re.sub(r"^(?:and|or)\s+", "", unit, flags=re.I)
        compound_groups = re.fullmatch(r"\(([^()]*)\)\s+\(([^()]*)\)", unit)
        if compound_groups:
            for group in compound_groups.groups():
                weighted_group = re.fullmatch(r"(.*)\s*:\s*(\d+(?:\.\d+)?)", group)
                if weighted_group:
                    yield weighted_group.group(1), weighted_group.group(2)
                else:
                    yield group, active_weight
            if closes_weight:
                active_weight = None
            continue

        unit_weight = active_weight
        parenthetical = PAREN_WEIGHT_RE.fullmatch(unit)
        if parenthetical:
            unit = parenthetical.group(1)
            unit_weight = parenthetical.group(2)

        yield unit, unit_weight
        if closes_weight:
            active_weight = None


def normalize_tag(raw_tag: str) -> str | None:
    if raw_tag.strip() in {":3", ";)"}:
        return raw_tag.strip()
    tag = raw_tag.replace("\u00a0", " ").replace("’", "'").replace("“", '"').replace("”", '"')
    tag = tag.replace('"캐릭터 이름"', "character name")
    tag = re.sub(r"\((?:색상|옷 색상|야광봉 색상)\)", "", tag)
    tag = re.sub(r"\(진한 색\)", "dark-colored", tag)
    tag = re.sub(r"\(연한 색\)", "light-colored", tag)
    tag = re.sub(r"\(동물\)", "animal", tag)
    tag = normalize_space(tag)

    # Remove true outer grouping while keeping meaningful inner constructs such
    # as `heart (symbol)` intact.
    previous = None
    while tag != previous:
        previous = tag
        if (tag.startswith("(") and tag.endswith(")")) or (
            tag.startswith("{") and tag.endswith("}")
        ):
            tag = normalize_space(tag[1:-1])
    tag = tag.replace("::", "")
    tag = normalize_space(tag.strip("[]{};,:. \t\r\n"))
    tag = re.sub(r"^(?:and|or)\s+", "", tag, flags=re.I)
    # Commas inside explanatory parentheses are still source tag separators.
    # After splitting, discard only the now-unmatched delimiter rather than
    # leaving invalid fragments such as `watercolor (medium`.
    if tag.count("(") > tag.count(")"):
        tag = tag.replace("(", " ")
    elif tag.count(")") > tag.count("("):
        tag = tag.replace(")", " ")
    tag = "".join(part if index % 2 else part.lower()
                  for index, part in enumerate(re.split(r'(\"[^\"]*\")', normalize_space(tag))))

    if not tag or tag in {"and", "or", "ver", "ver."}:
        return None
    if LABEL_RE.fullmatch(tag) or HANGUL_RE.search(tag):
        return None
    if not re.search(r"[a-z]", tag) and tag not in {":3"}:
        return None
    if tag.startswith(("prev ", "next ", "prompt image list")):
        return None
    return tag


def section_hint(label: str) -> str:
    compact = re.sub(r"\s+", "", label).lower()
    if "표정" in compact:
        return "expression"
    if "의상" in compact and ("구도" in compact or "포즈" in compact):
        return "mixed"
    if "의상" in compact:
        return "outfit"
    if "배경" in compact and ("구도" in compact or "포즈" in compact):
        return "mixed"
    if "배경" in compact:
        return "background"
    if "포즈" in compact:
        return "action"
    if "구도" in compact:
        return "composition"
    if "장식" in compact:
        return "accessory"
    return "other"


def infer_category(tag: str, hint: str) -> str:
    # Strong semantic matches override the sometimes inconsistent source labels.
    if EXPRESSION_RE.search(tag):
        return "expression"
    if COMPOSITION_RE.search(tag):
        return "composition"
    if ACTION_RE.search(tag):
        # Floating decorations belong to the environment, not the character pose.
        if re.search(r"\bfloating\b", tag) and re.search(
            r"\b(?:hearts?|stars?|petals?|particles?|ribbons?|balloons?|sweets?|"
            r"objects?|flowers?|crystals?|cards?|stickers?|pillows?|bats?|cherries|"
            r"sparkles?|butterflies)\b",
            tag,
            re.I,
        ):
            return "background"
        return "action"
    if hint == "background" and BACKGROUND_RE.search(tag):
        return "background"
    if re.search(r"\b(?:glow from|light from|lighting effect|light rays?|lens flare)\b", tag, re.I):
        return "background"
    if OUTFIT_RE.search(tag):
        return "outfit"
    if ACCESSORY_RE.search(tag):
        return "accessory"
    if BACKGROUND_RE.search(tag):
        return "background"
    if hint in {"background", "composition", "outfit", "accessory", "action", "expression"}:
        return hint
    return "other"


def build_library(
    occurrences: list[dict],
    source_prompts: dict[str, dict],
    excluded_male_sections: int,
    excluded_male_character_tags: int,
) -> dict:
    aggregate: dict[str, dict] = {}
    for occurrence in occurrences:
        tag = occurrence["tag"]
        record = aggregate.setdefault(
            tag,
            {
                "frequency": 0,
                "categoryVotes": Counter(),
                "sourcePageIds": set(),
                "sourcePromptIds": set(),
                "observedWeights": Counter(),
            },
        )
        record["frequency"] += 1
        record["categoryVotes"][occurrence["category"]] += 1
        record["sourcePageIds"].add(occurrence["pageId"])
        record["sourcePromptIds"].add(occurrence["promptId"])
        if occurrence["weight"] is not None:
            record["observedWeights"][occurrence["weight"]] += 1

    items: list[dict] = []
    category_counts: Counter = Counter()
    for tag in sorted(aggregate):
        record = aggregate[tag]
        category = min(
            record["categoryVotes"],
            key=lambda candidate: (
                -record["categoryVotes"][candidate],
                CATEGORY_PRIORITY.index(candidate),
            ),
        )
        category_counts[category] += 1
        item = {
            "tag": tag,
            "frequency": record["frequency"],
            "category": category,
            "sourcePageIds": sorted(record["sourcePageIds"]),
            "sourcePromptIds": sorted(record["sourcePromptIds"]),
        }
        if len(record["categoryVotes"]) > 1:
            item["categoryVotes"] = {
                key: record["categoryVotes"][key]
                for key in CATEGORY_PRIORITY
                if record["categoryVotes"][key]
            }
        if record["observedWeights"]:
            item["observedWeights"] = {
                key: record["observedWeights"][key]
                for key in sorted(record["observedWeights"], key=float)
            }
        items.append(item)

    return {
        "version": 1,
        "source": {
            "directory": "local visual reference archive",
            "pages": len({prompt["pageId"] for prompt in source_prompts.values()}),
            "prompts": len(source_prompts),
            "femaleOrNeutralCharacterTagsOnly": False,
            "catalogFemaleOrNeutralCharacterTagsOnly": True,
            "fullSourceVariantsPreserved": True,
        },
        "stats": {
            "items": len(items),
            "occurrences": len(occurrences),
            "sourceOccurrences": sum(len(section["tags"]) for prompt in source_prompts.values()
                                     for section in prompt["sections"]),
            "maleVariantSections": excluded_male_sections,
            "excludedMaleCharacterTags": excluded_male_character_tags,
            "categories": {
                category: category_counts[category]
                for category in CATEGORY_PRIORITY
            },
        },
        "sourcePrompts": source_prompts,
        "items": items,
    }


def write_library(library: dict) -> None:
    payload = json.dumps(library, ensure_ascii=False, indent=2)
    javascript = (
        "(function () {\n"
        '  "use strict";\n\n'
        f"  window.PM_CORPUS_LIBRARY = {payload};\n"
        "})();\n"
    )
    OUTPUT_PATH.write_text(javascript, encoding="utf-8", newline="\n")


def main() -> None:
    global SOURCE_DIR
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE_DIR)
    args = parser.parse_args()
    SOURCE_DIR = args.source.resolve()
    occurrences, source_prompts, excluded_male_sections, excluded_male_character_tags = parse_pages()
    library = build_library(
        occurrences,
        source_prompts,
        excluded_male_sections,
        excluded_male_character_tags,
    )
    annotate(library)
    write_library(library)
    write_report(library, ROOT / "docs" / "image-prompt-corpus.md")
    categories = library["stats"]["categories"]
    print(f"Wrote {OUTPUT_PATH.relative_to(ROOT)}")
    print(f"Items: {library['stats']['items']}")
    print(f"Occurrences: {library['stats']['occurrences']}")
    print(f"Male-variant sections retained for shared styling: {excluded_male_sections}")
    print(f"Excluded male character-count tags: {excluded_male_character_tags}")
    print("Categories: " + ", ".join(f"{key}={value}" for key, value in categories.items()))


if __name__ == "__main__":
    main()
