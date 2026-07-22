export const SCRIPT_LENGTH_OPTIONS = [
  {
    seconds: 60,
    timecode: '01:00',
    minCharacters: 350,
    maxCharacters: 450,
    description: '卖点展开与场景说明',
  },
  {
    seconds: 120,
    timecode: '02:00',
    minCharacters: 700,
    maxCharacters: 900,
    description: '完整测评与多场景演示',
  },
  {
    seconds: 180,
    timecode: '03:00',
    minCharacters: 1050,
    maxCharacters: 1350,
    description: '深度讲解与使用体验',
  },
  {
    seconds: 240,
    timecode: '04:00',
    minCharacters: 1400,
    maxCharacters: 1800,
    description: '系统测评与多卖点展开',
  },
  {
    seconds: 300,
    timecode: '05:00',
    minCharacters: 1750,
    maxCharacters: 2250,
    description: '长篇深度测评或完整故事',
  },
] as const;

export type ScriptDurationSeconds =
  (typeof SCRIPT_LENGTH_OPTIONS)[number]['seconds'];

export function getScriptLengthOption(seconds: ScriptDurationSeconds) {
  return SCRIPT_LENGTH_OPTIONS.find((option) => option.seconds === seconds)!;
}

export function countScriptCharacters(script: string): number {
  const narration = script
    .replace(/[（(]\s*(?:镜头|画面|分镜)[\s\S]*?[）)]/g, '')
    .replace(/【\s*(?:镜头|画面|分镜)[^】]*】/g, '');
  return Array.from(narration.replace(/\s/g, '')).length;
}
