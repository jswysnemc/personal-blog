const celestialBodies = {
  adjectives: [
    '寒冷的', '跃动的', '神秘的', '璀璨的', '遥远的', '沉默的',
    '燃烧的', '漂泊的', '永恒的', '孤独的', '温柔的', '狂野的',
    '沉睡的', '觉醒的', '古老的', '年轻的', '明亮的', '暗淡的',
    '旋转的', '静止的', '热情的', '冰冷的', '神圣的', '忧郁的',
    '欢快的', '深邃的', '闪烁的', '稳定的', '飘逸的', '坚定的'
  ],
  nouns: [
    '海王星', '彗星', '仙女座', '猎户座', '天狼星', '北极星',
    '火星', '木星', '土星', '金星', '水星', '冥王星',
    '银河', '星云', '黑洞', '脉冲星', '白矮星', '红巨星',
    '流星', '陨石', '卫星', '星团', '星系', '超新星',
    '双子座', '天蝎座', '狮子座', '织女星', '牛郎星', '启明星',
    '半人马座', '大熊座', '小熊座', '天琴座', '天鹅座', '仙后座'
  ]
};

function hashToIndices(hash: string): { adjIndex: number; nounIndex: number } {
  const adjPart = parseInt(hash.substring(0, 8), 16);
  const nounPart = parseInt(hash.substring(8, 16), 16);

  return {
    adjIndex: adjPart % celestialBodies.adjectives.length,
    nounIndex: nounPart % celestialBodies.nouns.length
  };
}

export function mapFingerprintToName(fingerprintHash: string): string {
  const { adjIndex, nounIndex } = hashToIndices(fingerprintHash);
  const adjective = celestialBodies.adjectives[adjIndex];
  const noun = celestialBodies.nouns[nounIndex];

  return `${adjective}${noun}`;
}

export function generateAvatarColor(fingerprintHash: string): string {
  const hue = parseInt(fingerprintHash.substring(16, 20), 16) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}
