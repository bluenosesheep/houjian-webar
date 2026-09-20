export const solarTerms = [
  { id: "lichun", name: "立春", season: "spring" },
  { id: "yushui", name: "雨水", season: "spring" },
  { id: "jingzhe", name: "惊蛰", season: "spring", phenology: ["桃始华", "仓庚鸣", "鹰化为鸠"], task: "寻找一处正在苏醒的生命" },
  { id: "chunfen", name: "春分", season: "spring" },
  { id: "qingming", name: "清明", season: "spring" },
  { id: "guyu", name: "谷雨", season: "spring" },
  { id: "lixia", name: "立夏", season: "summer" },
  { id: "xiaoman", name: "小满", season: "summer" },
  { id: "mangzhong", name: "芒种", season: "summer" },
  { id: "xiazhi", name: "夏至", season: "summer" },
  { id: "xiaoshu", name: "小暑", season: "summer" },
  { id: "dashu", name: "大暑", season: "summer" },
  { id: "liqiu", name: "立秋", season: "autumn" },
  { id: "chushu", name: "处暑", season: "autumn" },
  { id: "bailu", name: "白露", season: "autumn" },
  { id: "qiufen", name: "秋分", season: "autumn" },
  { id: "hanlu", name: "寒露", season: "autumn" },
  { id: "shuangjiang", name: "霜降", season: "autumn" },
  { id: "lidong", name: "立冬", season: "winter" },
  { id: "xiaoxue", name: "小雪", season: "winter" },
  { id: "daxue", name: "大雪", season: "winter" },
  { id: "dongzhi", name: "冬至", season: "winter" },
  { id: "xiaohan", name: "小寒", season: "winter" },
  { id: "dahan", name: "大寒", season: "winter" }
];

export const jingzhe = solarTerms.find((term) => term.id === "jingzhe");
