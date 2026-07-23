const PARAGRAPH_TARGET_LENGTH = 180;
const PARAGRAPH_MIN_LENGTH = 90;

const SECTION_MARKER = /^(?:【(?:画面|镜头|场景|口播|旁白|字幕|动作)[：:]|[（(](?:画面|镜头|场景|口播|旁白|字幕|动作)[：:])/u;
const SHOT_MARKER = /[（(【\[]\s*(?:镜头|画面|场景|动作|分镜)\s*[：:]\s*([\s\S]*?)\s*[）)】\]]/gu;

export type ScriptTableRow = {
  shot: string;
  copy: string[];
};

function splitLongSentence(sentence: string): string[] {
  if (sentence.length <= PARAGRAPH_TARGET_LENGTH) return [sentence];

  const clauses = sentence.match(/[^，,：:、]+[，,：:、]?/gu) ?? [sentence];
  const parts: string[] = [];
  let current = '';

  for (const clause of clauses) {
    if (
      current.length >= PARAGRAPH_MIN_LENGTH &&
      current.length + clause.length > PARAGRAPH_TARGET_LENGTH
    ) {
      parts.push(current);
      current = clause;
    } else {
      current += clause;
    }
  }

  if (current) parts.push(current);
  return parts;
}

function splitLongLine(line: string): string[] {
  const withSectionBreaks = line.replace(
    /([^\n])(?=(?:【(?:画面|镜头|场景|口播|旁白|字幕|动作)[：:]|[（(](?:画面|镜头|场景|口播|旁白|字幕|动作)[：:]))/gu,
    '$1\n'
  );

  return withSectionBreaks.split('\n').flatMap((section) => {
    const sentences = (
      section.match(/[^。！？!?；;]+[。！？!?；;]?/gu) ?? []
    ).flatMap(splitLongSentence);
    const paragraphs: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      const next = sentence.trim();
      if (!next) continue;

      const startsSection = SECTION_MARKER.test(next);
      const wouldBeTooLong =
        current.length >= PARAGRAPH_MIN_LENGTH &&
        current.length + next.length > PARAGRAPH_TARGET_LENGTH;

      if (current && (startsSection || wouldBeTooLong)) {
        paragraphs.push(current);
        current = next;
      } else {
        current += next;
      }
    }

    if (current) paragraphs.push(current);
    return paragraphs;
  });
}

export function formatScriptParagraphs(script: string): string[] {
  return script
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap(splitLongLine);
}

export function formatScriptText(script: string): string {
  return formatScriptParagraphs(script).join('\n\n');
}

export function formatScriptRows(script: string): ScriptTableRow[] {
  const normalized = script.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  const markers = Array.from(normalized.matchAll(SHOT_MARKER));
  if (markers.length === 0) {
    return [
      {
        shot: '未标注镜头',
        copy: formatScriptParagraphs(normalized),
      },
    ];
  }

  const rows: ScriptTableRow[] = [];
  const leadingCopy = normalized.slice(0, markers[0].index).trim();
  if (leadingCopy) {
    rows.push({
      shot: '开场',
      copy: formatScriptParagraphs(leadingCopy),
    });
  }

  markers.forEach((marker, index) => {
    const markerStart = marker.index ?? 0;
    const copyStart = markerStart + marker[0].length;
    const copyEnd = markers[index + 1]?.index ?? normalized.length;
    const copy = normalized.slice(copyStart, copyEnd).trim();

    rows.push({
      shot: marker[1].replace(/\s+/g, ' ').trim() || `镜头 ${index + 1}`,
      copy: formatScriptParagraphs(copy),
    });
  });

  return rows;
}
