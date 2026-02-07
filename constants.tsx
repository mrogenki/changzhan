
import { Activity, ActivityType, AdminUser, UserRole, Member } from './types';

export const INITIAL_ACTIVITIES: Activity[] = [
  {
    id: '1',
    type: ActivityType.REGULAR,
    title: '長展分會週二早晨例會',
    date: '2024-06-18',
    time: '06:30',
    location: '台北市大安區忠孝東路四段 218 號 (阿波羅大廈)',
    price: 500,
    picture: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=2069&auto=format&fit=crop',
    description: '每週一次的能量交流，精準商務對接。歡迎各界菁英蒞臨指導。',
    status: 'active'
  }
];

export const INITIAL_ADMINS: AdminUser[] = [
  {
    id: 'super-admin-01',
    name: '總管理員',
    phone: '0925981577',
    password: '981577',
    role: UserRole.SUPER_ADMIN
  }
];

export const INITIAL_MEMBERS: Member[] = [
  // 三尊
  { id: 'm314', member_no: '314', industry_chain: '工商', industry_category: '電腦機房系統整合業', name: '徐聖恩', company: '歐友科技', intro: '歐友科技 有專業的技術團隊，提供給您-Non-STOP 不斷電的整合服務，讓您用電省電不斷電，智慧節能作環保。' },
  { id: 'm276', member_no: '276', industry_chain: '幸福', industry_category: '殯葬禮儀服務業', name: '林恆暉', company: '永吉殯儀', intro: '真誠服務每個環節，讓一切圓滿善終「永吉殯儀」給您最安心的力量' },
  { id: 'm358', member_no: '358', industry_chain: '幸福', industry_category: '命理業', name: '陳欣囍', company: '陳欣囍命理', intro: '八字占星紫微斗數流年論命、取名改名、擇日、占卜問事、陽宅堪輿。' },
  
  // 第1組
  { id: 'm79', member_no: '79', industry_chain: '工商', industry_category: '品牌形象設計', name: '郭信德', company: '威格品牌設計', intro: 'LOGO包裝到展場，威格品牌設計為你打造最佳市場行銷武器！' },
  { id: 'm254', member_no: '254', industry_chain: '幸福', industry_category: '花卉業', name: '蔡宓瑾', company: 'November', intro: 'November讓美麗的花禮 增添您生活色彩 點亮人生每個重要時刻' },
  { id: 'm412', member_no: '412', industry_chain: '健康', industry_category: '銀耳養生業', name: '張哲維', company: '嚴選阿里山銀耳', intro: '嚴選阿里山原生種銀耳，每一口都喝的到真材實料，更能喝到健康強壯。受邀全台11間遠百大遠百、微風、長庚醫院環球、台茂等各大指標性百貨進駐及快閃' },
  { id: 'm294', member_no: '294', industry_chain: '美食', industry_category: '果乾業', name: '邱煥霖', company: '曠野文農', intro: '曠野文農嫩果乾-產道、渠道、食道。嚴選產地、優良通路、美好風味。' },
  { id: 'm219', member_no: '219', industry_chain: '工商', industry_category: '人力仲介', name: '洪水生', company: '人力仲介', intro: '您累了？老人/幼兒/病患無人顧工廠缺人手,專業,印/泰/菲/越~外勞仲介' },
  { id: 'm441', member_no: '441', industry_chain: '幸福', industry_category: '西服業', name: '王文杉', company: '訂製西服', intro: '訂製服裝/裁縫' },

  // 第2組
  { id: 'm267', member_no: '267', industry_chain: '工商', industry_category: '專利商標業', name: '李世森', company: '專利商標事務所', intro: '「維護客戶權益、權益以客為尊」，守護客戶智財權，權益是最佳領航者！' },
  { id: 'm341', member_no: '341', industry_chain: '幸福', industry_category: '婚宴會館', name: '余美琦', company: '88號樂章', intro: '88號樂章，四大主體宴會廳，三個多功能包廂，小到1桌大到100桌，結婚喜宴，公司餐敘，社團會議，是最佳的選擇，選擇88讓您家庭事業 發 發 發' },
  { id: 'm391', member_no: '391', industry_chain: '工商', industry_category: '手機通訊販售業', name: '陳裕憲', company: '雲端數位館', intro: '門號申辦手機續約，快速維修，手機配件，皆可找雲端數位館' },
  { id: 'm16', member_no: '16', industry_chain: '工程', industry_category: '住宅包租代管', name: '辜博鴻', company: '社會住宅', intro: '北/北/基/桃/台中/台南團隊服務 ，升級社會住宅&免費出租管理，一條龍服務服務~評估房屋價值/找物件/規劃裝修/出租/管理/維修/投資…' },
  { id: 'm436', member_no: '436', industry_chain: '幸福', industry_category: '婚紗攝影業', name: '林建和', company: '婚紗攝影', intro: '婚紗拍照、婚禮攝影、婚紗禮服租借、全家福、情侶照、個人寫真、企業團體形象照。' },
  { id: 'm421', member_no: '421', industry_chain: '工程', industry_category: '松山信義房仲業', name: '廖偉勛', company: '千萬經紀人', intro: '千萬經紀人 提供顧問式的VIP服務' },
  { id: 'm443', member_no: '443', industry_chain: '工程', industry_category: '照明燈具業', name: '黃宇聲', company: '照明燈具', intro: '主要商品為:室內用燈、室外用燈、工業用燈、商辦用燈。營業銷售範圍: LED燈 銷售、封裝、代工、客製化、以及代理各大廠牌LED燈。' },

  // 第3組
  { id: 'm102', member_no: '102', industry_chain: '美食', industry_category: '中式辦桌業', name: '張文昱', company: '水蛙師', intro: '水蛙師帶領的團隊，企業尾牙、春酒、社區餐敘，以安心的食材、精湛的廚藝，擄獲饕客的味蕾' },
  { id: 'm200', member_no: '200', industry_chain: '工程', industry_category: '汽車維修保養業', name: '梁嘉承', company: '車得適', intro: '車得適用診斷儀器查修提供原廠零件電瓶輪胎愛車保修事都在車得適' },
  { id: 'm431', member_no: '431', industry_chain: '健康', industry_category: '代謝體控保健食品', name: '林俐昕', company: '聖麗', intro: '健康美麗找聖麗，代謝管理好，體態沒煩惱。' },
  { id: 'm216', member_no: '216', industry_chain: '工商', industry_category: '廣告招牌業', name: '楊子龍', company: '廣告招牌', intro: 'LED廣告招牌、LED字幕機、無接縫招牌、不銹鋼字牌、廣告定點彩繪、各式反光路標、景觀照明量化系統' },
  { id: 'm273', member_no: '273', industry_chain: '幸福', industry_category: '兒童松果體濳能開發業', name: '葉家齊', company: '松果體潛能開發', intro: '松果體潛能開發，提升專注力、記憶力、自信心，改善情緒管理。' },
  { id: 'm437', member_no: '437', industry_chain: '工程', industry_category: '低溫倉儲業', name: '李承軒', company: '東裕冷凍', intro: '東裕冷凍' },

  // 第4組
  { id: 'm120', member_no: '120', industry_chain: '工商', industry_category: 'OA事務機器', name: '陳政斌', company: 'OA事務機器', intro: 'OA讓你影印機印得出來、傳真機傳得出去、公司發大財！' },
  { id: 'm154', member_no: '154', industry_chain: '工商', industry_category: '音響設備業', name: '彭建樺', company: 'PETER專業影音診所', intro: '買對機器只有50分，專業調整與前置作業，才能讓您達到100分！專業選擇-請找PETER專業影音診所' },
  { id: 'm440', member_no: '440', industry_chain: '健康', industry_category: '穿戴式靜脈雷射醫材業', name: '蔡蕓安', company: '靜脈雷射', intro: '穿戴式靜脈雷射與高壓氧是目前預防醫學的好夥伴' },
  { id: 'm414', member_no: '414', industry_chain: '美食', industry_category: '商用冷泡茶業', name: '程浡暢', company: '愉茶曼舞', intro: '愉茶曼舞-喝出你的態度，讓每一口茶「都有型」' },
  { id: 'm351', member_no: '351', industry_chain: '工程', industry_category: '新建大樓水電工程業', name: '高郁書', company: '松展水電工程行', intro: '松展水電工程行從事新建大樓電氣工程，給排水工程，消防工程' },
  { id: 'm442', member_no: '442', industry_chain: '健康', industry_category: '石墨烯機能服飾業', name: '謝玉蕙', company: '機能服飾', intro: '穿上石墨稀，讓你愛上更完美的自己' },

  // 第5組
  { id: 'm281', member_no: '281', industry_chain: '健康', industry_category: '食藥品檢驗業', name: '趙昱雯', company: '安諾檢驗', intro: '衛福部認證之第三方公正單位，針對食品.化妝品.健康食品.髮妝品類提供檢測服務。檢驗，找我！選擇安諾，給您安心信賴的承諾。' },
  { id: 'm199', member_no: '199', industry_chain: '美食', industry_category: '台灣美食行銷業', name: '張智鴻', company: '蔥阿伯', intro: '「蔥阿伯」是台灣蔥抓餅/餡餅第一品牌，外銷美/加/港澳/新馬等地，立志將台灣在地的好味道行銷全世界。' },
  { id: 'm439', member_no: '439', industry_chain: '美食', industry_category: '酸菜供應商', name: '何承恩', company: '歐巴吃泡菜', intro: '韓國的歐巴吃泡菜，台灣的歐巴吃酸菜。' },
  { id: 'm418', member_no: '418', industry_chain: '工程', industry_category: '玻璃工程業', name: '高明武', company: '伍益玻璃工程', intro: '各式玻璃安裝/維修/鋁間窗找伍益玻璃工程' },
  { id: 'm264', member_no: '264', industry_chain: '工程', industry_category: '清潔服務業', name: '陳睿翊', company: '馥誠清潔', intro: '裝潢細清、洗地打蠟請找馥誠給您最細心、真誠、 高品質的服務' },
  { id: 'm277', member_no: '277', industry_chain: '美食', industry_category: '咖啡業', name: '顏秋香', company: 'LAVITA', intro: 'LAVITA致力於技術傳承, 用專業的角度替客戶量身製作，幫助想要創業的客戶一臂之力' },

  // 第6組
  { id: 'm265', member_no: '265', industry_chain: '工程', industry_category: '系統傢俱廚具業', name: '廖偉材', company: '綠瑟系統傢俱', intro: '想讓你家變溫馨嗎.想讓你家廚具變美麗嗎.請找綠瑟系統傢俱阿偉' },
  { id: 'm332', member_no: '332', industry_chain: '工程', industry_category: '拆除工程業', name: '曾偉銘', company: '拆除工程', intro: '打牆，舊屋拆除，廠房拆除，裝潢拆除，機械拆除，幫助你打造新空間前的重要程序' },
  { id: 'm430', member_no: '430', industry_chain: '工程', industry_category: '大安/中正/萬華區房仲業', name: '鍾穎', company: '住宅地產代理', intro: '住宅地產代理' },
  { id: 'm428', member_no: '428', industry_chain: '工程', industry_category: '日式空間美學設計', name: '曾必騰', company: '承新設計', intro: '開創美好空間新生活，選擇「承新」是您最好的選擇。' },
  { id: 'm360', member_no: '360', industry_chain: '健康', industry_category: '傳統整復推拿業', name: '陳翌隆', company: '專業詠春', intro: '專業詠春，系統教學，簡單、直接、有效，達到養生健體防身的目標' },
  { id: 'm203', member_no: '203', industry_chain: '工商', industry_category: '數位大圖輸出業', name: '許清淵', company: '數位大圖輸出', intro: 'PVC大圖輸出。3.2米無接縫單/雙噴。阻光帆布單/雙噴。寬幅燈片/牆面貼圖。帆布/車體廣告。' },

  // 第7組
  { id: 'm20', member_no: '20', industry_chain: '工商', industry_category: '會計師', name: '李孟燕', company: '會計師事務所', intro: '以幫助創業者成功的熱忱,提供您工商,帳務及稅務的全面服務！' },
  { id: 'm352', member_no: '352', industry_chain: '工商', industry_category: '電腦設備業', name: '陳泓樺', company: '電腦設備', intro: '提供專業維修服務 及客製化組裝桌機以及二手整新桌機及筆電' },
  { id: 'm403', member_no: '403', industry_chain: '幸福', industry_category: '木作藝品業', name: '徐雅俐', company: '木作藝品', intro: '以實木利用原本的特性與天然的紋路、顏色、味道，來製作出符合我們日常使用隨身小物。' },
  { id: 'm261', member_no: '261', industry_chain: '美食', industry_category: '火鍋業', name: '丁禹賓', company: '偵軒鍋物', intro: '偵軒鍋物以「品美食 品享受 品幸福」提供客戶用心安心的各式精緻鍋物料理' },
  { id: 'm364', member_no: '364', industry_chain: '美食', industry_category: '烏梅汁製造銷售業', name: '邱新恩', company: '北京乾隆烏梅汁', intro: '採用特級烏梅.砂糖.冰糖.麥芽.等真材實料.遵循古法精煉十餘小時細火熬製而成之健康天然飲品.逢公司饋贈親友或尾牙.搭配"北京乾隆烏梅汁"最能提供賓客甘醇好喝.活力健康的飲品' },
  { id: 'm433', member_no: '433', industry_chain: '美食', industry_category: '九份景觀餐廳業', name: '余慧愉', company: '九份紅樓', intro: '九份紅樓' },

  // 第8組
  { id: 'm215', member_no: '215', industry_chain: '工商', industry_category: '運動團體服', name: '黃俊英', company: '團體服', intro: '志工(選舉)背心、T恤、Polo衫、背心，一件以上即可製作' },
  { id: 'm343', member_no: '343', industry_chain: '工程', industry_category: '發電機機組業', name: '張亦伸', company: '發電機機組', intro: '銷售汽/柴油引擎發電機組,提供顧客銷售、維修、保養的完整服務。' },
  { id: 'm374', member_no: '374', industry_chain: '美食', industry_category: '蔬果產銷', name: '劉介棋', company: '蔬果產銷', intro: '好山!好水!好新鮮!健康蔬果每一天!' },
  { id: 'm233', member_no: '233', industry_chain: '幸福', industry_category: '旅館業', name: '蔡明璁', company: '悠趣旅店', intro: '提供您舒適溫馨又平價的住宿服務,商務旅遊來悠趣,悠然有樂趣' },
  { id: 'm321', member_no: '321', industry_chain: '工程', industry_category: '家具業', name: '劉怡萱', company: '城鼎家具', intro: '城鼎家具專營各式風格家具，從古典到現代，從量產到訂製' },
  { id: 'm189', member_no: '189', industry_chain: '工商', industry_category: '飯店紡織業', name: '高榮富', company: '全閎事業', intro: '床單被套檯布椅套選全閎事業一定紅' },

  // 第9組
  { id: 'm29', member_no: '29', industry_chain: '健康', industry_category: '太極拳教學', name: '吳坤達', company: '太極拳', intro: '太極拳教學 氣血循環青春凍齡，促進代謝提升免疫，訓練肌力靈活有力！太極~充滿活力，幸福滿溢！' },
  { id: 'm400', member_no: '400', industry_chain: '幸福', industry_category: '國外旅遊業', name: '王亮', company: '國外旅遊', intro: '旅客出國旅遊代辦簽證、預訂機票、飯店、團體、獎勵旅遊、會展、高爾夫、潛水、滑雪、健行、自由行。' },
  { id: 'm348', member_no: '348', industry_chain: '工程', industry_category: '油漆工程業', name: '黃偉傑', company: '油漆工程', intro: '室內裝修之油漆工程，外牆施作，木作烤漆、噴漆…等工程服務。' },
  { id: 'm408', member_no: '408', industry_chain: '工程', industry_category: '商空設計業', name: '陳俊安', company: '商空設計', intro: '公司擁有30多年專業的室內設計經驗，並有專業的室內設計及工程管理等相關證照' },
  { id: 'm279', member_no: '279', industry_chain: '美食', industry_category: '蜂蜜產品業', name: '曾玉婷', company: '嘟嘟家蜂蜜', intro: '嘟嘟家蜂蜜是來自台灣本地蜂農所出產的台灣蜂蜜，保證不添加、自主管理嚴格' },
  { id: 'm410', member_no: '410', industry_chain: '工程', industry_category: '木作工程業', name: '吳津田', company: '木作工程', intro: '從事木工已有近40年的經驗.秉持用真誠的心.幫服務過的客戶打造完美的居家環境°舉凡家中天花板.隔間.廚櫃都可為大家服務°引薦目標(合作對象)/室內設計師/商空設計師/房仲業/各位親朋好友等' },

  // 第10組
  { id: 'm164', member_no: '164', industry_chain: '幸福', industry_category: '演藝節目設計', name: '林逸忻', company: '演藝節目', intro: '演藝節目找逸忻,為您的活動精彩加分！耳目一新！' },
  { id: 'm78', member_no: '78', industry_chain: '美食', industry_category: '精緻外燴業', name: '許淳凱', company: '精緻外燴', intro: '歐式自助餐/茶會點心/會議便當/活動餐盒，外燴找元氣人人都滿意！' },
  { id: 'm354', member_no: '354', industry_chain: '健康', industry_category: '超氧離子水（臭氧淨水設備業）', name: '甘炎立', company: '超氧離子機', intro: '專營超氧離子機，推廣洗滌抑菌商品，客戶包含餐廳、醫療院所、寵物店、家庭⋯' },
  { id: 'm251', member_no: '251', industry_chain: '美食', industry_category: '音樂餐廳業', name: '林文聖', company: '音樂餐廳', intro: '每晚都有現場樂團演唱的時尚音樂餐廳' },
  { id: 'm305', member_no: '305', industry_chain: '健康', industry_category: '經絡調理業', name: '韋紫婕', company: '經絡調理', intro: '經絡不通用藥無功、經絡一通百病不侵，疏通經絡，排濕、排寒、排毒啟動身體的自我療癒能力，讓我們一起來打造百病不侵的健康人生吧' },
  { id: 'm155', member_no: '155', industry_chain: '工程', industry_category: '病媒防治業', name: '張洺定', company: '阿洺除蟲', intro: '專門防治室內外各式害蟲，病媒防治不是一次性服務 是阿洺對您一輩子的責任，除蟲找阿洺，安心無害蟲' },

  // 第11組
  { id: 'm344', member_no: '344', industry_chain: '工商', industry_category: '國際貨運承攬業', name: '賴文雄', company: '國際貨運', intro: '進出口正式貿易，海運、空運、報關、貿易金流規劃' },
  { id: 'm372', member_no: '372', industry_chain: '工程', industry_category: '隔音工程業', name: '林炳坤', company: '隔音工程', intro: '因應全方位樓地板之隔音需求,解決台灣海島型氣候及多地震的環境提供客製化服務無須個別耗費昂貴裝修費用' },
  { id: 'm334', member_no: '334', industry_chain: '健康', industry_category: '口腔清潔用品業', name: '周志平', company: 'DENTISTE', intro: '讓您每天會笑與愛充滿自信出門的牙醫選DENTISTE' },
  { id: 'm434', member_no: '434', industry_chain: '幸福', industry_category: 'DJ業', name: '林宜璇', company: 'Anita DJ', intro: 'DJ需求找Anita,炸裂現場沒話講' },
  { id: 'm230', member_no: '230', industry_chain: '工商', industry_category: '辦公傢俱業', name: '白佳宸', company: '佳宸辦公家具', intro: '辦公家具要加成、辦公家具找佳宸' },
  { id: 'm342', member_no: '342', industry_chain: '工程', industry_category: '自駕車&聲波影像偵測設備業', name: '汪益弘', company: '聲波影像', intro: '自駕車定位，動態，煞車加速等法規測試,聲音相機，讓聲音看得見,為您找到氣體洩漏，漏電，車輛機械異音與噪音源。' },

  // 第12組
  { id: 'm380', member_no: '380', industry_chain: '工程', industry_category: '住宅室內設計業', name: '黃作淮', company: '住宅室內設計', intro: '創造夢想好宅/綠建材居家環境更舒適' },
  { id: 'm407', member_no: '407', industry_chain: '幸福', industry_category: '珠寶業', name: '陳宥璿', company: '珠寶', intro: '公司成立36年，專營 鑽石 紅寶石、藍寶石 、舊金回收。從情人節的定情禮物，到嬰兒彌月禮盒。訂製屬於您風格的珠寶首飾，提供您完善的一條龍服務。' },
  { id: 'm176', member_no: '176', industry_chain: '工商', industry_category: '禮贈品業', name: '陳路得', company: '路得禮贈品', intro: '禮贈品找路得，讓您一舉數得！路得熊賀！' },
  { id: 'm416', member_no: '416', industry_chain: '工商', industry_category: '自媒體行銷業', name: '黃柏勳', company: '自媒體行銷', intro: 'KOL 網紅行銷、自媒體經營、透過自媒體讓企業主提高品牌形象，拓展線上通路，媒合適合的KOL合作, 達到品牌 網紅 消費者三贏的局面' },
  { id: 'm386', member_no: '386', industry_chain: '幸福', industry_category: '聲音後期製作業', name: '余政憲', company: '杰瑞音樂', intro: '杰瑞音樂有限公司的負責人，是臺灣影視產業聲音後期製作公司前三名公司。業務包括音樂音效製作、影像有聲製作，生涯至今已入圍五次電視金鐘獎入圍最佳聲音設計，獲獎一次。國內外影展入圍已達30幾座，更拿到2018年義大利米蘭國際影展最佳配樂獎。全方位的聲音製作專業公司' },
  { id: 'm402', member_no: '402', industry_chain: '工程', industry_category: '搬家業', name: '歐陽勲', company: '搬家業', intro: '我們從事貨運、搬家、廢棄物清運及中古二手買賣多年，對於家具及設備之拆裝，會比一般搬家同業更為專業，讓您可以輕鬆無憂的進行搬遷。' },

  // 第13組
  { id: 'm81', member_no: '81', industry_chain: '工程', industry_category: '土地代書', name: '周俊彥', company: '三鈦地政士', intro: '三鈦地政士事務所。專業代理不動產糾紛調處，稅務規劃，測量登記。' },
  { id: 'm322', member_no: '322', industry_chain: '工商', industry_category: '清潔用品製造業', name: '蘇鴻林', company: '郁生清潔用品', intro: '40年專業居家清潔用品製造廠,所有清潔問題,郁生為您淨力而為,潔淨所能' },
  { id: 'm435', member_no: '435', industry_chain: '美食', industry_category: '東南亞蔬食料理餐廳業', name: '盧采嫻', company: '東南亞蔬食', intro: '南洋風味料理 自製商品：雲朵天貝真空包，叄巴醬好吃辣椒醬' },
  { id: 'm426', member_no: '426', industry_chain: '美食', industry_category: '精品茶葉銷售業', name: '翁莉芸', company: '莉芸茶葉', intro: '莉芸茶葉 每天陪你喝茶' },
  { id: 'm208', member_no: '208', industry_chain: '工商', industry_category: '商用洗滌業', name: '劉文偉', company: '商用洗滌', intro: '30年的餐廳洗衣經驗，獨家為客戶財產編列管理與修補用負離子磁化軟水洗滌系統，提供給您最專業的服務。' },
  { id: 'm384', member_no: '384', industry_chain: '美食', industry_category: '古早味伴手禮業', name: '潘威銓', company: '古早味伴手禮', intro: '將古早味（油飯、肉粽、蘿蔔糕等等）美食包裝成禮品在各大節日送禮用，以網路銷售為主，並設有門市及餐廳' },

  // 第14組
  { id: 'm2', member_no: '2', industry_chain: '工商', industry_category: '人壽保險業', name: '王崇霖', company: '人壽保險', intro: '保險專業：醫療意外防癌險，讓妳放心！長看+退休，讓您尊嚴又安心，將愛留給您的最愛' },
  { id: 'm395', member_no: '395', industry_chain: '工商', industry_category: '產險業', name: '瞿必宸', company: '產險', intro: '個人及第三人財產保險，包含車險、工程險、責任險、商業火險、水運險．．．等' },
  { id: 'm438', member_no: '438', industry_chain: '美食', industry_category: '網紅餐酒館業', name: '張傑克', company: '網紅餐酒館', intro: '每一道料理每一杯調酒都是故事，你有故事我有酒的說故事餐酒館' },
  { id: 'm399', member_no: '399', industry_chain: '幸福', industry_category: '車輛租賃業', name: '曾冠銘', company: '車輛租賃', intro: '協助企業客戶處理車輛各種疑難雜症，並可以合法節稅，讓用車更加安心省心。' },
  { id: 'm240', member_no: '240', industry_chain: '幸福', industry_category: '影像行銷製作業', name: '華慧瑩', company: '影像行銷', intro: '本身是導演也是導播，拍攝影片電視台票選第一，擅長拍攝短影音、企業形象影片、商品介紹、活動紀錄、演唱會、電影、戲劇、紀錄片…等，策劃公司年度影像行銷方案，也可協助撰寫拍攝腳本。' },
  { id: 'm345', member_no: '345', industry_chain: '工商', industry_category: '進口生活日用品業', name: '黃明傳', company: '進口日用品', intro: '專門做歐洲、美國、日本進口生活用品' },

  // 第15組
  { id: 'm33', member_no: '33', industry_chain: '工程', industry_category: '衛浴設備', name: '白煌陽', company: 'TOTO衛浴', intro: '豐富您的人生，體貼您的家人，值得珍藏的瑰寶，TOTO衛浴！' },
  { id: 'm368', member_no: '368', industry_chain: '工商', industry_category: '商業攝影業', name: '譚法平', company: '法平攝影', intro: '商業攝影找‘法平’，讓您滿意又安心' },
  { id: 'm409', member_no: '409', industry_chain: '工商', industry_category: '基礎化工原料業', name: '黃文祺', company: '化工原料', intro: '提供眾多基礎化工原料相關貿易合作，合理報價配送快速。' },
  { id: 'm131', member_no: '131', industry_chain: '美食', industry_category: '堅果食品業', name: '李麗雲', company: '檳皇堅果', intro: '您今天健康了嗎?養生健康，吃堅果吃堅果找檳皇,檳皇堅果讓您健康久久久!!!' },
  { id: 'm432', member_no: '432', industry_chain: '工商', industry_category: '企業軟體專案開發業', name: '賴騰文', company: '榮沛科技', intro: '企業軟體找榮沛，專業整合最速配' },
  { id: 'm250', member_no: '250', industry_chain: '工程', industry_category: '弱電業', name: '張嘉元', company: '弱電工程', intro: '公司的電話，網路，門禁，監視，護士呼叫，錄音等設備及線路工程' },

  // 第16組
  { id: 'm146', member_no: '146', industry_chain: '工商', industry_category: '公關會展業', name: '唐伯寅', company: '威立顧問', intro: '公關，活動，展覽，國際會議及整合行銷的威立顧問- 規劃執行 令您滿意 創造無限附加價值 唐sir 為您服務' },
  { id: 'm289', member_no: '289', industry_chain: '美食', industry_category: '日式燒肉業', name: '賴郁芬', company: '基隆狸小路', intro: '基隆在地30年人氣燒肉名店，提供最新鮮的燒肉和海鮮 升官發財要慶祝，就到基隆狸小路' },
  { id: 'm361', member_no: '361', industry_chain: '工商', industry_category: '停車場業', name: '蕭深博', company: '停車場', intro: '' },
  { id: 'm195', member_no: '195', industry_chain: '美食', industry_category: '海鮮食材業', name: '徐承堉', company: '湧升海洋', intro: '湧升海洋是專業的永續海鮮品牌,供應養殖及捕撈的在地可追溯海鮮' },
  { id: 'm308', member_no: '308', industry_chain: '工程', industry_category: '建築師', name: '郭怡良', company: '建築師', intro: '開業28年建築師，專擅各類土地開發評估等公共工程及私有建築專案' },
  { id: 'm301', member_no: '301', industry_chain: '美食', industry_category: '海鮮景觀餐廳業', name: '楊朝旭', company: '海洋牧場', intro: '海洋牧場海鮮景觀餐廳位于台灣東北角貢寮區的九孔鮑魚海膽的養殖基地上方，提供視野寬闊的無敵海景及當地四季不同的季節性魚貨及海鮮料理' },

  // 第17組
  { id: 'm22', member_no: '22', industry_chain: '工程', industry_category: '水電工程', name: '陳進益', company: '水電工程', intro: '疑難雜症的水電維修。居家.大樓.店面.廠辦.新建大樓二次工程.水電裝潢施工' },
  { id: 'm187', member_no: '187', industry_chain: '幸福', industry_category: '中古汽車買賣', name: '陳俊銘', company: '中古汽車', intro: '中古汽車買賣，舉凡1~100萬之轎車､休旅車及商用車皆可為您效勞。讓你買的放心，開的更安心！' },
  { id: 'm429', member_no: '429', industry_chain: '美食', industry_category: '食品料理包業', name: '李冠勳', company: '料理包', intro: '中西式料理一應具全，可配合少量出貨，餐飲街邊店的缺工救星' },
  { id: 'm423', member_no: '423', industry_chain: '健康', industry_category: '電動牙刷業', name: '石永維', company: '電動牙刷', intro: '全球首創看見牙菌斑的電動牙刷，擁有多國專利認證，提供客製化ODM/OEM服務' },
  { id: 'm291', member_no: '291', industry_chain: '健康', industry_category: '牛樟芝業', name: '吳謝平', company: '牛樟芝', intro: '牛樟精髓，健康相隨' },
  { id: 'm246', member_no: '246', industry_chain: '美食', industry_category: '南北雜貨業', name: '蔡耀庭', company: '南北雜貨', intro: '南北雜貨找耀庭、讓你燕窩靈芝喝不停！' },

  // 第18組
  { id: 'm174', member_no: '174', industry_chain: '工商', industry_category: '律師', name: '陳進會', company: '律師', intro: '法學博士、執業4O餘年、提供法律顧問、諮詢、發函、契約、訴狀、夫妻財產登記、各類訴訟、商務仲裁，法律服務免煩惱，找進會律師上介好' },
  { id: 'm184', member_no: '184', industry_chain: '工程', industry_category: '家電業', name: '林靖脩', company: '家電', intro: '經銷各大廠牌之電視.冰箱.冷氣.洗衣機等大小家電產品、值得信賴!' },
  { id: 'm419', member_no: '419', industry_chain: '幸福', industry_category: '國內旅遊業', name: '黃佩琳', company: '東方旅行社', intro: '本公司東方旅行社股份有限公司、金順旅運有限公司乃交通部觀光局核准，榮獲中華民國旅行業品質保障協會會員，從事國內旅遊服務。秉持著專業領域永續經營的理念，嚴格控制每一個環節，在意每位顧客的反饋。提供最舒適、最合理、最優質的安排服務所有旅客，保障顧客之所有權利。所累積的口碑、商譽眾' },
  { id: 'm379', member_no: '379', industry_chain: '工商', industry_category: 'ESG輔導業', name: '余賢文', company: 'ESG輔導', intro: '2050淨零減碳, 利他利己利天下, 就從你我開始做起!' },
  { id: 'm298', member_no: '298', industry_chain: '工程', industry_category: '房仲業', name: '葉家同', company: '永慶不動產', intro: '永慶不動產提供最好的團隊․最棒的陣容․全國的聯賣，家同的誠信絕對讓您買屋放心賣屋安心，買屋請找家同賣屋請找家同' },
  { id: 'm326', member_no: '326', industry_chain: '幸福', industry_category: '薩克斯風教學', name: '張林峯', company: '薩克斯風', intro: '薩克斯風的大小事，請找張林峯' },

  // 第19組
  { id: 'm46', member_no: '46', industry_chain: '工程', industry_category: '窗簾業', name: '林瑾梧', company: '勁匠窗簾', intro: '窗的亮點家的聚點,完美居家生活品味就交給勁匠窗簾幸福滿好運連' },
  { id: 'm389', member_no: '389', industry_chain: '工程', industry_category: '磁磚業', name: '游竹強', company: '磁磚', intro: '專門銷售國內外磁磚,從外牆到室內磁磚,從一坪到一萬坪,從10公分車道磚到320公分大板磚都有在賣' },
  { id: 'm244', member_no: '244', industry_chain: '健康', industry_category: '眼鏡業', name: '張俊賢', company: '眼鏡', intro: '眼鏡零售，批發， 各式名牌太陽眼鏡，隱形眼鏡， 驗光服務。' },
  { id: 'm415', member_no: '415', industry_chain: '工商', industry_category: '印刷業', name: '陳泰元', company: '印刷', intro: '主要負責業務為客製化彩盒/禮盒/手提紙袋/紙箱及相關紙製品的印刷及設計！' },
  { id: 'm362', member_no: '362', industry_chain: '美食', industry_category: '素食餐廳業', name: '蘇燕燕', company: '素食餐廳', intro: '餐飲資歷有30年，想推廣特別不一樣的素食，讓大家吃的美味又健康。' },
  { id: 'm226', member_no: '226', industry_chain: '工商', industry_category: '網站建置業', name: '賴奕銘', company: '網站建置', intro: '20年網路程式開發經驗，網站建置、維護找奕銘，給您最高CP值的服務' },

  // 第20組
  { id: 'm87', member_no: '87', industry_chain: '幸福', industry_category: '婚禮佈置', name: '沈秀桂', company: '熊熊蕾絲逅', intro: '家有喜事，請找熊熊來佈置，客製化您的主場，熊熊蕾絲逅，熊甘心，熊大心' },
  { id: 'm312', member_no: '312', industry_chain: '健康', industry_category: '足體SPA業', name: '王志豪', company: '足體SPA', intro: '本館提供專業職人服務足底按摩、身體按摩、桑拿，塑造東區新標準。' },
  { id: 'm382', member_no: '382', industry_chain: '健康', industry_category: '水療業', name: '陳奎儒', company: '水療SPA', intro: '運用精油SPA水調理,結合整復推拿手法,增強身體自癒能力,恢復健康活力' },
  { id: 'm383', member_no: '383', industry_chain: '美食', industry_category: '冷凍港點工廠業', name: '林家賢', company: '緻宏食品', intro: '緻宏食品生產五星及港式點心,是飯店、餐廳及主廚們最佳好幫手,讓產品品質自己說話,就是緻宏食品產品的魅力' },
  { id: 'm411', member_no: '411', industry_chain: '健康', industry_category: '中醫業', name: '蔡定佑', company: '中醫', intro: '中醫服務項目:傷科處置醫療，保健，身體調理，營養科學' },
  { id: 'm280', member_no: '280', industry_chain: '幸福', industry_category: '鍋具業', name: '許登旺', company: '鍋具', intro: '有心、用心、求創新，要更好，非變不可。' },
  { id: 'm444', member_no: '444', industry_chain: '工程', industry_category: '工程五金業', name: '楊佑誠', company: '大山五金', intro: '大山五金負責人；堅持快速正確、準時誠信，整合倉配供應。我們賣建材與工程工具；到貨快，讓工地不停工。' }
];
