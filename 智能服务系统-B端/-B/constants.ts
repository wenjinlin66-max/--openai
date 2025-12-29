

export const SERVICES_CATALOG = [
  { name: "经典剪发", price: 40 },
  { name: "豪华面部护理", price: 85 },
  { name: "深层组织按摩", price: 120 },
  { name: "美甲与修脚", price: 70 },
  { name: "胡须修剪", price: 30 },
  { name: "全身芳香疗法", price: 150 },
  { name: "高定色彩美学染发", price: 1680 },
  { name: "资深设计总监剪裁", price: 380 },
  { name: "奢华鱼子酱头皮护理", price: 680 },
  { name: "日式空气感纹理烫", price: 1280 },
  { name: "男士尊享复古油头", price: 280 },
  { name: "卡诗黑钻鱼子酱护理", price: 980 }
];

// Helper to get formatted display string
export const SERVICES_LIST = SERVICES_CATALOG.map(s => `${s.name} ($${s.price})`);
