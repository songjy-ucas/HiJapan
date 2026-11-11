import json
import pathlib
import re
import sys

from argostranslate import translate


source_root = pathlib.Path(sys.argv[1])
output_path = pathlib.Path(sys.argv[2])
levels = ["N5", "N4", "N3", "N2", "N1"]

installed = translate.get_installed_languages()
english = next(language for language in installed if language.code == "en")
chinese = next(language for language in installed if language.code == "zh")
translator = english.get_translation(chinese)

grammar_terms = {
    "indirect object": "间接宾语",
    "direct object": "直接宾语",
    "plain form": "普通形",
    "polite form": "礼貌形",
    "subject": "主语",
    "object": "宾语",
    "topic": "主题",
    "particle": "助词",
    "clause": "从句",
    "noun": "名词",
    "verb": "动词",
    "adjective": "形容词",
}

formation_terms = {
    "Verb-volitional": "动词意志形",
    "Verb-plain": "动词普通形",
    "Verb-dict": "动词辞书形",
    "Verb-stem": "动词ます形去掉ます",
    "Verb-nai": "动词ない形",
    "Verb-te": "动词て形",
    "Verb-ta": "动词た形",
    "Verb-ba": "动词ば形",
    "i-Adj-ku": "い形容词く形",
    "na-Adj": "な形容词",
    "i-Adj": "い形容词",
    "Question word": "疑问词",
    "Sentence": "句子",
    "Noun": "名词",
    "Group": "组",
    "counter": "量词",
    "particle": "助词",
    "potential form": "可能形",
    "plain form": "普通形",
    "same verb": "同一个动词",
    "giver": "给予者",
    "receiver": "接受者",
    "quantity": "数量",
    "number": "数字",
    "final u": "词尾う段假名",
    "ichidan verbs": "一段动词",
    "Verb": "动词",
    "stem": "词干",
}

manual = {
    "jlpt-grammar-n5-wa": {
        "formation_zh": "名词 + は",
        "meaning_zh": "提示句子的主题，相当于“说到……／……是……”",
        "explanation_zh": "助词「は」写作 は，但读作「わ」。它把前面的内容设为谈话主题，真正要说明的新信息通常放在「は」后面。例句「私は学生です」先提出“我”这个主题，再说明“是学生”。不要把这里的「は」简单理解成中文的“是”。",
    },
    "jlpt-grammar-n5-ga-subject": {
        "formation_zh": "名词 + が",
        "meaning_zh": "标记主语，常用于指出新出现或需要强调的信息",
        "explanation_zh": "助词「が」标出动作、状态或现象的主体。回答「谁／什么……？」时，疑问词和答案通常都用「が」，如「誰が来ますか」「田中さんが来ます」。描述眼前刚发现的现象时也常用「が」，如「雨が降っています」。",
    },
    "jlpt-grammar-n5-o": {
        "formation_zh": "名词 + を",
        "meaning_zh": "标记动作直接作用的对象；也可标记移动经过或离开的场所",
        "explanation_zh": "助词「を」写作 を，但通常读作「お」。它最常放在宾语后面，如「本を読みます」中的「本」是“读”的对象。和「歩く／出る」等移动动词搭配时，也可以表示经过或离开的场所。",
    },
    "jlpt-grammar-n4-te-oku": {
        "formation_zh": "动词て形 + おく",
        "meaning_zh": "提前做某事以备后用；做完后让状态保持不变",
        "explanation_zh": "「〜ておく」有两种常见用法：一是提前准备，如「ホテルを予約しておく」（事先订好酒店）；二是让结果保持原样，如「窓を開けておく」（把窗户开着）。口语里「ておく」常缩约为「とく」，「でおく」常缩约为「どく」。",
    },
    "jlpt-grammar-n3-hodo": {
        "formation_zh": "动词普通形 / い形容词 / な形容词 + な / 名词 + ほど",
        "meaning_zh": "达到……的程度；甚至……；越……越……（依具体句型）",
        "explanation_zh": "「ほど」表示程度，可以用一个具体结果来说明程度有多高，如「立てないほど疲れた」（累到站不起来）。在「〜ば〜ほど」中表示“越……越……”。它与「くらい」意思接近，但「ほど」通常更书面，也更适合强调较高程度。",
    },
}

manual_examples = {
    "jlpt-sentence-grammar-n5-wa-1": "我是学生。",
    "jlpt-sentence-grammar-n5-wa-2": "今天天气很好。",
    "jlpt-sentence-grammar-n5-wa-3": "这本书很有趣。",
    "jlpt-sentence-grammar-n5-ga-subject-1": "正在下雨。",
    "jlpt-sentence-grammar-n5-ga-subject-2": "谁打开了窗户？",
    "jlpt-sentence-grammar-n5-ga-subject-3": "我去。（由我来去。）",
    "jlpt-sentence-grammar-n5-o-1": "我每天早上吃面包。",
    "jlpt-sentence-grammar-n5-o-2": "姐姐买了一个新包。",
    "jlpt-sentence-grammar-n5-o-3": "我在公园里散了步。",
}

japanese_pattern = re.compile(r"[\u3040-\u30ff\u3400-\u9fff々〆ヶ〜「」『』]+")
cache = {}


def clean(text):
    text = re.sub(r"\{\\[^}]+\}", "", text)
    text = re.sub(r"页:\s*\d+", "", text)
    text = re.sub(r"\(\s*中文\s*\(\s*简体\s*\)\s*\)", "", text)
    text = re.sub(r"[\ue000-\uf8ff]", "", text)
    text = re.sub(r"\\{2,}", "", text)
    text = re.sub(r"\+{4,}", "", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = text.replace("写了", "写作").replace("宣告", "读作")
    text = text.replace("永远不要", "不能").replace("问语", "疑问词")
    text = text.replace(";", "；").replace(",", "，")
    text = re.sub(r"\s+([。；，！？])", r"\1", text)
    text = text.strip(" .。")
    if text and text[-1] not in "。！？":
        text += "。"
    return text


def translate_english(text):
    if not text:
        return ""
    if text in cache:
        return cache[text]
    result = translator.translate(text)
    for term, chinese_term in grammar_terms.items():
        result = re.sub(rf"\b{re.escape(term)}\b", chinese_term, result, flags=re.I)
    result = clean(result)
    cache[text] = result
    return result


def translate_mixed(text):
    """Translate only the English spans and put original Japanese back verbatim.

    Sending mixed English/Japanese directly through Argos caused Japanese particles
    to become placeholders such as QQ, long runs of plus signs and transliterations.
    Splitting the spans means the translation engine never sees or rewrites Japanese.
    """
    if not text:
        return ""
    pieces = []
    cursor = 0
    for match in japanese_pattern.finditer(text):
        english_part = text[cursor : match.start()]
        if english_part.strip(" .,;:()'\""):
            pieces.append(translate_english(english_part).rstrip("。"))
        else:
            pieces.append(english_part.strip())
        pieces.append(f"「{match.group(0)}」")
        cursor = match.end()
    tail = text[cursor:]
    if tail.strip(" .,;:()'\""):
        pieces.append(translate_english(tail).rstrip("。"))
    elif tail.strip():
        pieces.append(tail.strip())
    return clean(" ".join(piece for piece in pieces if piece))


def translate_formation(text):
    result = text
    for term, chinese_term in sorted(
        formation_terms.items(), key=lambda item: len(item[0]), reverse=True
    ):
        result = re.sub(rf"\b{re.escape(term)}\b", chinese_term, result, flags=re.I)
    result = re.sub(r"\s*\+\s*", " + ", result)
    result = re.sub(r"\s*/\s*", " / ", result)
    result = re.sub(r"\s{2,}", " ", result).strip()
    return result


sentences = {}
for level in levels:
    with (source_root / f"sentences-{level}.jsonl").open(encoding="utf-8") as handle:
        for line in handle:
            item = json.loads(line)
            sentences[item["id"]] = item

result = {
    "generated_by": "Argos Translate en-zh 1.9 with protected Japanese terms and grammar glossary",
    "status": "machine_translated_needs_review",
    "items": {},
}

for level in levels:
    with (source_root / f"grammar-{level}.jsonl").open(encoding="utf-8") as handle:
        grammar_items = [json.loads(line) for line in handle]
    for index, grammar in enumerate(grammar_items, start=1):
        examples = []
        for example_id in grammar.get("example_ids", []):
            example = sentences.get(example_id)
            if not example:
                continue
            examples.append(
                {
                    "id": example_id,
                    "translation_zh": manual_examples.get(example_id)
                    or example.get("translation_zh")
                    or translate_english(example.get("translation_en_reference") or ""),
                }
            )
        translated = {
            "formation_zh": translate_formation(grammar.get("formation_reference_en") or ""),
            "meaning_zh": translate_mixed(grammar.get("meaning_reference_en") or ""),
            "explanation_zh": translate_mixed(grammar.get("notes_reference_en") or ""),
            "example_id": examples[0]["id"] if examples else None,
            "example_zh": examples[0]["translation_zh"] if examples else "",
            "examples": examples,
        }
        translated.update(manual.get(grammar["id"], {}))
        result["items"][grammar["id"]] = translated
        if index % 25 == 0:
            print(f"{level}: {index}/{len(grammar_items)}", flush=True)

output_path.parent.mkdir(parents=True, exist_ok=True)
with output_path.open("w", encoding="utf-8") as handle:
    json.dump(result, handle, ensure_ascii=False, indent=2)

bad_pattern = re.compile(
    r"(?:JATERM|GRAMTERM|贾特|格拉姆|纳-Adj|\bQQ\b|\bHO\b|\+{4,}|\ufffd)",
    re.I,
)
bad_items = []
for item_id, translated in result["items"].items():
    combined = " ".join(
        str(translated.get(field, ""))
        for field in ("formation_zh", "meaning_zh", "explanation_zh")
    )
    if bad_pattern.search(combined):
        bad_items.append(item_id)
if bad_items:
    raise RuntimeError(f"corrupted translation markers remain: {bad_items[:10]}")
print(f"WROTE {len(result['items'])} grammar translations -> {output_path}")
