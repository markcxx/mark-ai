import type { Message } from "@/lib/chat/types";

/** Public-source replay from a real search/read/find/image-selection run. */
export const webResearchMessage: Message = {
  id: "web-research-preview",
  role: "model",
  model: "MarkAI",
  content:
    "以下为真实网页检索结果的界面回放。图片来自故宫博物院《太和殿》页面，可点击放大，并通过来源链接核对。[1]",
  segments: [
    {
      type: "tool",
      webSearch: {
        callId: "qa-search",
        tool: "web_search",
        query: "故宫博物院 太和殿 建筑 官方介绍",
        results: [
          {
            content:
              "太和殿，俗称“金銮殿”，位于紫禁城南北主轴线的显要位置，明永乐十八年（1420年）建成，称奉天殿。嘉靖四十一年（1562年）改称皇极殿。清顺治二年（1645年）改今名。自建成后屡遭焚毁，又多次重建，今天所见为清代康熙三十四年(1695年)重建后的形制。   \n　　太和殿面阔11间, 进深5间，建筑面积2377.00㎡，高26.92m，连同台基通高35.05m，为紫禁城内规模最大的殿宇。其上为重檐庑殿顶，屋脊两端安有高3.40m、重约4300kɡ的大吻。檐角安放10个走兽，数量之多为现存古建筑中所仅见。 [...] # 展览\n\n:   近期展览\n:   专馆\n:   原状陈列\n:   赴外展览\n\n# 教育\n\n:   教育新闻\n:   故宫讲坛\n:   书画考级\n:   故宫博物院教育中心\n:   国际博协培训中心\n:   故宫志愿者\n\n# 探索\n\n:   建筑\n:   藏品\n:   古籍\n:",
            score: 0.846159,
            title: "太和殿 - 故宫博物院",
            url: "https://www.dpm.org.cn/explore/building/236465.html",
            citationId: 1,
          },
        ],
        status: "done",
        contentKind: "search_snippets",
        images: [
          {
            url: "https://img.dpm.org.cn/Uploads/Picture/2019/12/31/s5e0a95c8c2815.jpg",
            title: "太和殿- 故宫博物院",
            description:
              "A large, traditional Chinese palace with a golden-tiled roof, red wooden structure, and ornate details, accessed by a broad stone staircase in front of the expansive courtyard.",
            id: "img_694fb216a1d2cb49",
          },
          {
            url: "https://img.dpm.org.cn/Uploads/Picture/2020/04/17/s5e9926e6ea567.jpg",
            title: "太和殿- 故宫博物院",
            description:
              "A panoramic view of the Forbidden City’s Hall of Supreme Harmony with its grand, golden-roofed main building flanked by smaller structures, set against a clear blue sky.",
            id: "img_302de4d55e71b4ea",
          },
        ],
      },
    },
    {
      type: "tool",
      webSearch: {
        callId: "qa-read",
        tool: "read_webpage",
        query: "https://www.dpm.org.cn/explore/building/236465.html",
        results: [
          {
            url: "https://www.dpm.org.cn/explore/building/236465.html",
            title: "太和殿 - 故宫博物院",
            content: "太和殿",
            citationId: 1,
            favicon: "https://www.dpm.org.cn/favicon.ico",
          },
        ],
        status: "done",
        url: "https://www.dpm.org.cn/explore/building/236465.html",
        title: "太和殿 - 故宫博物院",
        description: "太和殿",
        siteName: "故宫博物院",
        images: [
          {
            url: "https://img.dpm.org.cn/Uploads/Picture/2020/04/17/s5e9926e6ea567.jpg",
            title: "太和殿",
            description: "太和殿",
            sourceUrl: "https://www.dpm.org.cn/explore/building/236465.html",
            id: "img_302de4d55e71b4ea",
          },
          {
            url: "https://img.dpm.org.cn/Uploads/Picture/2020/07/03/s5efefbd5093a9.jpg",
            title: "太和殿",
            description: "太和殿",
            sourceUrl: "https://www.dpm.org.cn/explore/building/236465.html",
            id: "img_7eb266209dc4dc9a",
          },
        ],
        contentKind: "page",
        content:
          "1: # 导览\n2: \n3: # 展览\n4: \n5: # 教育\n6: \n7: # 探索\n8: \n9: # 学术\n10: \n11: # 文创\n12: \n13: # 关于\n14: \n15: ![太和殿](https://img.dpm.org.cn/Uploads/Picture/2020/04/17/s5e9926e6ea567.jpg) \n16: 太和殿\n17: \n18: ![太和殿](https://img.dpm.org.cn/Uploads/Picture/2020/07/03/s5efefbd5093a9.jpg)\n19: \n20: ![太和殿](https://img.dpm.org.cn/Uploads/Picture/2020/04/17/s5e99275d2689f.jpg)\n21: \n22: ![太和殿](https://img.dpm.org.cn/Uploads/Picture/2020/07/03/s5efefbd5060be.jpg)\n23: \n24: ![从太和门望太和殿](https://img.dpm.org.cn/Uploads/Picture/2019/12/31/s5e0a95c8c2815.jpg) \n25: 从太和门望太和殿\n26: \n27: ![太和殿](https://img.dpm.org.cn/Uploads/Picture/2020/04/17/s5e9926fdab31b.jpg)\n28: \n29: ![乾隆皇帝御笔匾联复原归位后的太和殿内景](https://img.dpm.org.cn/Uploads/Picture/dc/14498.jpg)\n30: \n31: ![太和殿宝座](https://img.dpm.org.cn/Uploads/Picture/dc/1606[1024].jpg)\n32: \n33: ![太和殿藻井](https://img.dpm.org.cn/Uploads/Picture/dc/1602[1024].jpg)\n34: \n35: ![太和殿前的铜鹤](https://img.dpm.org.cn/Uploads/Picture/dc/1608.jpg)\n36: \n37: ![太和殿前的铜龟](https://img.dpm.org.cn/Uploads/Picture/dc/1",
        page: {
          startLine: 1,
          endLine: 64,
          totalLines: 64,
          truncated: false,
        },
      },
    },
    {
      type: "tool",
      webSearch: {
        callId: "qa-find",
        tool: "find_in_page",
        query: "太和殿",
        results: [
          {
            url: "https://www.dpm.org.cn/explore/building/236465.html",
            title: "太和殿 - 故宫博物院",
            content: "太和殿",
            citationId: 1,
            favicon: "https://www.dpm.org.cn/favicon.ico",
          },
        ],
        status: "done",
        url: "https://www.dpm.org.cn/explore/building/236465.html",
        title: "太和殿 - 故宫博物院",
        description: "太和殿",
        siteName: "故宫博物院",
        images: [
          {
            url: "https://img.dpm.org.cn/Uploads/Picture/2020/04/17/s5e9926e6ea567.jpg",
            title: "太和殿",
            description: "太和殿",
            sourceUrl: "https://www.dpm.org.cn/explore/building/236465.html",
            id: "img_302de4d55e71b4ea",
          },
          {
            url: "https://img.dpm.org.cn/Uploads/Picture/2020/07/03/s5efefbd5093a9.jpg",
            title: "太和殿",
            description: "太和殿",
            sourceUrl: "https://www.dpm.org.cn/explore/building/236465.html",
            id: "img_7eb266209dc4dc9a",
          },
        ],
        contentKind: "page_matches",
        content:
          "13: # 关于\n14: \n15: ![太和殿](https://img.dpm.org.cn/Uploads/Picture/2020/04/17/s5e9926e6ea567.jpg) \n16: 太和殿\n17: \n18: ![太和殿](https://img.dpm.org.cn/Uploads/Picture/2020/07/03/s5efefbd5093a9.jpg)\n19: \n20: ![太和殿](https://img.dpm.org.cn/Uploads/Picture/2020/04/17/s5e99275d2689f.jpg)\n21: \n22: ![太和殿](https://img.dpm.org.cn/Uploads/Picture/2020/07/03/s5efefbd5060be.jpg)\n23: \n24: ![从太和门望太和殿](https://img.dpm.org.cn/Uploads/Picture/2019/12/31/s5e0a95c8c2815.jpg) \n25: 从太和门望太和殿\n26: \n27: ![太和殿](https://img.dpm.org.cn/Uploads/Picture/2020/04/17/s5e9926fdab31b.jpg)\n28: \n29: ![乾隆皇帝御笔匾联复原归位后的太和殿内景](https://img.dpm.org.cn/Uploads/Picture/dc/14498.jpg)\n30: \n31: ![太和殿宝座](https://img.dpm.org.cn/Uploads/Picture/dc/1606[1024].jpg)\n32: \n33: ![太和殿藻井](https://img.dpm.org.cn/Uploads/Picture/dc/1602[1024].jpg)\n34: \n35: ![太和殿前的铜鹤](https://img.dpm.org.cn/Uploads/Picture/dc/1608.jpg)\n36: \n37: ![太和殿前的铜龟](https://img.dpm.org.cn/Uploads/Picture/dc/1607[1024].jpg)\n38: ",
        page: {
          startLine: 15,
          endLine: 35,
          totalLines: 64,
          matches: [15, 16, 18, 20, 22, 24, 25, 27, 29, 31, 33, 35],
          truncated: false,
        },
      },
    },
    {
      type: "tool",
      webSearch: {
        callId: "qa-show",
        tool: "show_images",
        query: "图片展示",
        results: [
          {
            url: "https://www.dpm.org.cn/explore/building/236465.html",
            title: "太和殿",
            citationId: 1,
            content: "",
          },
        ],
        status: "done",
        contentKind: "image_selection",
        images: [
          {
            url: "https://img.dpm.org.cn/Uploads/Picture/2020/04/17/s5e9926e6ea567.jpg",
            title: "太和殿",
            description: "太和殿",
            sourceUrl: "https://www.dpm.org.cn/explore/building/236465.html",
            id: "img_302de4d55e71b4ea",
          },
          {
            url: "https://img.dpm.org.cn/Uploads/Picture/2020/07/03/s5efefbd5093a9.jpg",
            title: "太和殿",
            description: "太和殿",
            sourceUrl: "https://www.dpm.org.cn/explore/building/236465.html",
            id: "img_7eb266209dc4dc9a",
          },
        ],
      },
    },
    {
      type: "content",
      content:
        "以下为真实网页检索结果的界面回放。图片来自故宫博物院《太和殿》页面，可点击放大，并通过来源链接核对。[1]",
    },
  ],
};
