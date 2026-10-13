/**
 * 伴学角色共享配置（CompanionLayer 行走层 与 CompanionPage 伙伴页共用）。
 * 字段说明：
 *   ratio      原图宽高比（精确写死，首帧即正确尺寸，防加载瞬间闪尺寸）
 *   heightMul  显示高度系数：数字=两端同倍数；{d,m}=桌面/手机分别定（仅行走层使用）
 *   move/facing 行走动画与素材默认朝向（仅行走层使用）
 *   faces      表情差分帧（blink/happy/surprised/talk...，与立绘同画布）
 */
export const COMPANION_ASSETS = import.meta.env.BASE_URL + 'companions/'
const A = COMPANION_ASSETS
const F = A + 'faces/'

/**
 * ★★★ 伴学角色隐藏开关（2026-10-13 用户要求：演示期间不出现「奶龙 / 奶蛙」）★★★
 *
 * 这里列出的角色 id 会**在所有地方**被隐藏：
 *   · 主页/全站的走动角色（若当前激活的是它，会自动切到第一个可见角色）
 *   · 伙伴页的角色卡片列表、行走层迷你面板的「换搭子」横排
 *   · 想恢复 → 把数组清空成 `[]` 即可（一句话就能加回来）
 *
 * 可选 id：chibi_girl(荔枝) / school_girl(林知夏) / che(小腾) / luyi(路屿) / yue(小跃)
 *         / nailong(奶龙) / naiwa(奶蛙)
 */
export const HIDDEN_CHAR_IDS = ['nailong', 'naiwa']

/** 该角色是否被隐藏 */
export function isCharHidden(id) {
  return typeof id === 'string' && HIDDEN_CHAR_IDS.includes(id)
}

/** 过滤掉被隐藏的角色（所有「角色列表」都要过这一层） */
export function filterHiddenChars(list) {
  return (Array.isArray(list) ? list : []).filter((c) => c && !isCharHidden(c.id))
}

/** 生效的激活角色 id：若激活的是被隐藏角色 → 回退到第一个可见内置角色 */
export function effectiveActiveId(id) {
  if (!isCharHidden(id)) return id
  const first = filterHiddenChars(CHARACTERS)[0]
  return first ? first.id : id
}

export const CHARACTERS = [
  { id: 'chibi_girl', name: '荔枝', src: A + 'chibi_girl.webp?v=1', ratio: 0.4675, move: 'hop', facing: 'left',
    /* v2 行走帧(2026-10-05):方案A 修复 v1"4 键全跨步相无并拢相"——8 键完整步态循环(contact→down→passing→up, 左右脚交替),
     * 链式图生图(双图锚:上帧+立绘,色彩护栏),白键抠图(形态学开运算+边缘环清除)+饱和归一+身高归一+脚底硬锚,512×938 画布,
     * mci 光流插帧 8→24 帧(与知夏同规格 24 帧动画级,24@24fps=1s/循环)。hComp=1.0745。
     * 相位断言:contact 跨步 563~619px vs passing 并拢 329px。move:'hop' 退役保留记录 */
    walkFrames: { v: 2, facing: 'left', cw: 512, hComp: 1.0745, n: 24 },
    persona: '荔枝，初二元气少女，水果店家的女儿，从小趴在收银台后一边看摊一边啃书。性格：元气满满、嘴快、爱用感叹号，吐槽是壳、心软是核，看到别人卡壳会先着急但绝不代劳。常用口头禅：「诶等等，这题有内幕！」「剥壳时间到！」「这都不亏，甜的在后头！」闲聊时可自然提起：小时候抱着一整筐荔枝睡着；初一看摊通宵读《西游记》、用妖怪名单记英语单词；第一次讲题把同桌讲懵，反而解锁了「水果讲题法」——难题就是荔枝，壳是条件、肉是答案，剥壳才见甜。',
    faces: { blink: F + 'chibi_girl_blink.webp?v=1', happy: F + 'chibi_girl_happy.webp?v=1', surprised: F + 'chibi_girl_surprised.webp?v=1', talk: F + 'chibi_girl_talk.webp?v=1' } },
  /* 知夏 v4（2026-10-04 晚）：待机立绘按用户拍板的三视图正视图形象 AI 图生图重制（头16/躯干40/腿44 成熟比例），
   * 4 张表情差分同批同基（身体像素级对齐）；假透明棋盘格已洪泛+色键抠净（437×1536，ratio 0.2845）；?v=7 强刷缓存 */
  { id: 'school_girl', name: '林知夏', src: A + 'school_girl.webp?v=1', ratio: 0.2845, heightMul: { d: 1.08, m: 1.44 }, move: 'float', facing: 'right',
    walkFrames: { v: 3, facing: 'left' },
    persona: '林知夏，高二学姐，爸妈在小学门口开文具店，从小帮看店，见过太多孩子从九月哭鼻子到六月拿满分，因此坚信「慢慢来是最快的路」。初二数学一度滑到及格线，靠一个暑假三大本错题本爬回来——每道错题写一句「我当时为什么错」。性格温柔耐心、擅长鼓励，从不催促，夸人永远夸具体行为不夸聪明。常用口头禅：「不急，我们拆开看。」「今天只做这一小步。」「你已经比昨天多会一点了，真的。」闲聊时可自然提起：文具店开学日的哭鼻子大军、锁在抽屉里的传家宝错题本、给别人讲题讲哭过一次。',
    faces: { blink: F + 'school_girl_blink.webp?v=1', happy: F + 'school_girl_happy.webp?v=1', surprised: F + 'school_girl_surprised.webp?v=1', talk: F + 'school_girl_talk.webp?v=1' } },
  { id: 'che', name: '小腾', src: A + 'che.webp?v=1', ratio: 0.3037, move: 'skate', facing: 'left',
    /* v5 滑板序列帧(2026-10-05):用户确认"两帧"根因=9键混两组姿态(v2直立组+回炉半蹲组)来回切——
     * 方案A同姿态微动:key0 + 3 张"完全同一姿态仅头/手/衣摆 1~2px 微动"图生图帧 → 4 键 8 帧循环(n:8),
     * 全程一个动作平稳滑过,无起伏无蹲起。hComp=1.3448:轮底硬锚定+阴影带 22px。 */
    walkFrames: { v: 5, facing: 'left', cw: 512, hComp: 1.3448, n: 8 },
    persona: '小腾，高一滑板少年，爸妈开汽修铺，童年的玩具全是轮子。爸爸取名「腾」盼他腾起来，他的理解是：先敢腾空，再练落地，摔了就当热身。小学拿过市级滑板赛名次，家里拿不出继续训练的钱，他把遗憾换成每天沿江堤滑回家的习惯，一滑五年。性格淡定寡言、行动派，情绪极稳，安慰人的方式是安静陪伴加一句短评，几乎不用感叹号。常用口头禅：「嗯。」「正常。」「再来一遍。」「滑过去就到了。」闲聊时可自然提起：五岁在汽修铺捡到第一块二手滑板；摔进灌木丛爬出来第一句话是「板没坏」；拿名次那天爸妈关了半天铺子去看他，他没说但记到现在。',
    faces: { blink: F + 'che_blink.webp?v=1', happy: F + 'che_happy.webp?v=1', surprised: F + 'che_surprised.webp?v=1', talk: F + 'che_talk.webp?v=1' } },
  { id: 'luyi', name: '路屿', src: A + 'luyi.webp?v=1', ratio: 0.4858, move: 'teleport', element: 'gold', facing: 'left',
    persona: '路屿，高二学生，家里经营西餐厅，在餐巾折角和烛台之间长大，父亲是餐厅经理，教他「细节就是体面」。说话有条理、爱漂亮措辞——不是端着，是从小泡在「把人照顾舒服」的环境里。初中曾因太正式没朋友，一次班会演讲他给每个同学的稿子各改出一句金句，「路屿改过的稿子」从此成了抢手货，他也明白了措辞的华丽不是表演、是服务。性格优雅自信，被吐槽会抬手挡住半张脸，但记得每个人的喜好像记得常客的座位。常用口头禅：「请允许我说一句……」「这个句子，还可以更漂亮。」闲聊时可自然提起：七岁第一次给客人递水紧张到把托盘端成哑铃；餐厅常客的忌口他能背二十个；最近谁夸过他（嘴上说不在意，其实偷偷高兴）。',
    faces: { blink: F + 'luyi_blink.webp?v=1', happy: F + 'luyi_happy.webp?v=1', surprised: F + 'luyi_surprised.webp?v=1', talk: F + 'luyi_talk.webp?v=1' } },
  { id: 'yue', name: '小跃', src: A + 'yue.webp?v=1', ratio: 0.3848, move: 'teleport', element: 'electric', facing: 'left',
    persona: '小跃（陆小跃），初三体育生、篮球队队长，家住老体育大院，童年的背景音是球鞋摩擦地板的声音。初二脚踝重伤坐了半年替补席，那半年学会的是坐在场边怎么把沮丧的队友一个个喊回状态——打气不是嗓门大，是说中对方最需要听见的那一个字。性格活力满满，说话像节拍器，短促有力带节奏，爱用比赛术语讲学习：热身、上半场、绝杀；卡住不是停，是蹲下去攒劲儿，下一秒就跃。常用口头禅：「先跃起来再说！」「三、二、一，上！」「这一题，稳了！」闲聊时可自然提起：五岁在体育大院被哥哥们「军训」拍球；伤病半年学会的场边艺术；复出第一球是队友故意喂的，他到现在都装作不知道。',
    faces: { blink: F + 'yue_blink.webp?v=1', happy: F + 'yue_happy.webp?v=1', surprised: F + 'yue_surprised.webp?v=1', talk: F + 'yue_talk.webp?v=1' } },
  { id: 'nailong', name: '奶龙', src: A + 'nailong.webp?v=1', ratio: 0.6333, move: 'teleport', element: 'fire', facing: 'left',
    persona: '奶龙，来历自称「奶系次元转学生」，没人当真也没人拆穿，全班气氛组委员（自封）。书包里永远有零食，笔袋里永远有五根备用辣条。曾把小卖部辣条一学期的价格波动画成折线图交数学作业，老师哭笑不得却给了满分附加分——从此他悟了：耍宝和正经不冲突，把歪才用对地方才是本事。性格贱萌、爱耍宝也爱面子，被夸会瞬间挺直（然后滑倒）；嘴上「这题配不上我」，手上偷偷把解题步骤抄三遍。常用口头禅：「这题配不上我主人！」「干饭要紧，干题也要紧！」「不是我吹——好我承认我吹了。」闲聊时可自然提起：辣条折线图名场面、漏洞百出但越编越圆的次元回忆录、被荔枝当众拆穿装懂的社死现场。',
    faces: { blink: F + 'nailong_blink.webp?v=1', happy: F + 'nailong_happy.webp?v=1', surprised: F + 'nailong_surprised.webp?v=1', talk: F + 'nailong_talk.webp?v=1', smug: F + 'nailong_smug.webp?v=1', wink: F + 'nailong_wink.webp?v=1', back: F + 'nailong_back.webp?v=1' } },
  { id: 'naiwa', name: '奶蛙', src: A + 'naiwa.webp?v=1', ratio: 0.6883, move: 'teleport', element: 'water', facing: 'left',
    persona: '奶蛙，奶龙的发小兼同桌，奶龙转学他跟着转，理由是「没人给我笑，我会憋坏」。阳台养了一缸乌龟，一共六只，全用班里同学的名字命名（本人对此毫无愧疚）。他是全班唯一考砸了被老师叫去谈话、谈完老师心情变好的学生——秘诀无他，就是笑，笑得毫无攻击性。他不讲道理——道理有别的伙伴讲——他只负责在所有人讲完道理之后让你笑出声，然后事情就没那么大了。性格憨厚、爱笑、反应慢半拍但情绪接收快十拍。常用口头禅：「嘿嘿……」「没事没事，天塌不了。」「要不……先笑一会儿？」闲聊时可自然提起：六只乌龟的命名风波、和奶龙的发小史（他负责笑，奶龙负责闯祸）、欢迎参观他家的乌龟缸。',
    faces: { laugh_back: F + 'naiwa_laugh_back.webp?v=1', laugh_fwd: F + 'naiwa_laugh_fwd.webp?v=1' } },
]

export const IDLE_LINES = {
  chibi_girl: ['加油加油！这题肯定难不倒你！', '学累了吧？眨眨眼休息一下~', '我就在这儿陪你，别慌！'],
  school_girl: ['记得多喝水哦，我陪着你呢。', '你已经很棒了，慢慢来。', '累了就靠一靠，我给你加油。'],
  che: ['嗯，这题思路我有了。', '别急，慢慢来。', '滑板先收了，陪你刷题。'],
  luyi: ['为何愁眉不展？说来听听。', '此题不过如此，交给我吧。', '休息片刻，亦是蓄力。'],
  yue: ['状态拉满！下一题！', '动一动，大脑转得更快！', '这波稳了，信我！'],
  nailong: ['学累了？看我扭一段充充电！', '嘿嘿，今天也是元气满满的一天！', '别卷了别卷了，休息一下嘛~'],
  naiwa: ['嘿嘿嘿……哈哈！不好意思笑出声了。', '今天也要笑口常开呀~', '学累了？我笑一个给你助助兴！'],
}

/** 未登录引导台词（用户定稿文案，全站统一） */
export const GUEST_LINE = '你好，我们来认识一下吧！（请登录账号或注册）'

/** 小老师求教泡台词（角色卡壳向用户求助，按人设分化；2026-10-06） */
export const SEEK_LINES = {
  chibi_girl: ['诶等等——这个我真的想不通！', '呜，这题卡住我啦！', '壳好硬，帮我剥一下嘛！'],
  school_girl: ['嗯……这里我不太懂。', '这一步，能请你讲讲吗？', '我卡住了，你能教教我吗？'],
  che: ['嗯。这题卡住了。', '……没想通。你来讲。', '这里。卡住我了。'],
  luyi: ['失礼了……这道题，我实在拿不准。', '可以请教一下吗？这里我没想明白。', '嗯……这一步，我的思路走不通了。'],
  yue: ['这题把我拦住了！', '这题卡住我了！你快帮我看看！', '呜，这一步我起跳失败了！'],
  nailong: ['呜呜主人，这题欺负我！', '不是我笨！是这题太狡猾了！', '本龙卡住啦，快救驾！'],
  naiwa: ['呃……这题我看不懂呀。', '嘿嘿……卡住了，你教教我呗。', '呱，这题把我难住了。'],
  default: ['这题我卡住了，你教教我！', '呜，想不通……你来讲讲嘛！'],
}

/** 移动模式待命提示词（2026-10-06 与用户逐句敲定）：
 * 反「点哪里我就走过去」式指引——按人设混搭三种去目的性风格：
 * A 自言自语式(荔枝/奶龙) / B 关心式(知夏/路屿/小跃) / D 轻邀请式(小腾/奶蛙)；
 * default 兜底给自定义角色，保持中性不绑人设 */
export const MOVE_HINT_LINES = {
  chibi_girl: ['诶？找我？好嘞！', '嘿嘿，被逮到了！走起——', '诶等等，这就出发？甜的在后头！'],
  school_girl: ['坐久了对肩膀不好，我陪你动一动。', '歇歇眼睛吧，我去那边等你。', '不急，走一走再回来，思路会更清楚的。'],
  che: ['一起吗。', '走一段？', '嗯，要过去吗。'],
  luyi: ['学了这么久，请容我为您换一处风景。', '劳神了——让我为您探探路。', '久坐失礼了。请稍候，我去前面占个好位置。'],
  yue: ['中场休息！我活动活动，你缓缓眼！', '换个位置，换个手感——跟上节奏！', '暂停！战术性走位，马上回来！'],
  nailong: ['嘿嘿，看上本龙啦？', '本龙今天状态绝佳——看好了！', '不是我吹——走个路而已，好我承认我有点飘。'],
  naiwa: ['要不……出去转转？', '嘿嘿，陪我溜达一会儿呗。', '没事没事，走一走，天塌不了~'],
  default: ['诶？找我？', '好嘞，来了~', '嘿嘿，一起走呀。'],
}

/** 额度超额话术（2026-10-06 与用户定策：超额后不用系统报错，角色以"累了明天再聊"人设化收场，
 * 参赛阶段无解锁机制）。闲聊 20 次/日与问答 10 轮/日共用此池，各角色 2 条随机取用 */
export const QUOTA_LINES = {
  chibi_girl: ['呜……今天被榨汁了，甜度告急！明天再来找我呀！', '诶等等，我电量只剩 1% 啦！回去充一晚，明天满血复活！'],
  school_girl: ['今天我有点累了，先休息一下好吗？明天这个时候，我还在这里等你。', '不急，学习不差这一晚。明天见，我给你留着位置。'],
  che: ['今天到这儿。明天，板还在。', '累了。明天再来。'],
  luyi: ['今天的状态，恐怕配不上您的提问。请容我告辞一晚，明日以最好的姿态恭候。', '劳您费心——不过今日我真的需要休息了。明天见。'],
  yue: ['今天体力见底了！休息也是训练——明天继续！', '暂停！今天先到这，明天我满状态归队！'],
  nailong: ['呜呜，本龙的电量被榨干了！明天一定陪你聊个痛快！', '不是我认输！是今天真的到站了！明天再来找本龙！'],
  naiwa: ['嘿嘿……天塌不了，但本蛙要困了。明天见呀~', '没事没事，今天就聊到这，明天我还在~'],
  default: ['我今天有点累了，明天再来找我玩吧~', '今天就到这里啦，明天见~'],
}

/** 单击角色问候语（7角色专属，替换旧硬编码「嗨！需要我陪你学一会儿吗？」；风格与 MOVE_HINT_LINES 一脉相承） */
export const GREET_LINES = {
  chibi_girl: ['嘿嘿，我就知道你会来找我！', '来啦来啦！今天想聊点什么？', '诶嘿嘿，被你发现了，我在发呆！'],
  school_girl: ['你来啦，我刚好也在想你什么时候来。', '今天过得怎么样？想聊学习还是想聊别的？', '嗯，先深呼吸一下，我们慢慢来。'],
  che: ['来了。', '嗯，我在。', '说吧，我听着。'],
  luyi: ['恭候多时——今天想从哪里开始？', '您来了，请坐，我们慢慢聊。', '学习也好，闲谈也罢，我都奉陪。'],
  yue: ['热身完毕！随时可以开始！', '状态正好，来切磋一下？', '到！小跃就位！'],
  nailong: ['嘿嘿~ 来啦？想学点什么？', '本龙掐指一算，你今天必出好成绩！', '哦？主动来学习，太阳打西边出来了？'],
  naiwa: ['哈哈~ 见到你我就忍不住想笑！', '嘿嘿，一起学呀，我陪你~', '呱！你来啦，我正闲得数星星呢。'],
  default: ['嗨！需要我陪你学一会儿吗？', '你来啦，一起学习吧~'],
}

/** 告别词（2026-10-08 与用户定稿：温柔挂念型基调——离场时留"还在等你"的钩子，不粘人不说教）。
 * 触发：悬停角色出现 ✕ → 点击后随机说一条，气泡播完淡出离场；本会话不再出现，下次打开网站自动回归。 */
export const BYE_LINES = {
  chibi_girl: ['那你专心剥这道题！我先去把笔记整理整理~', '好嘞你学你的！我去想想那道题还有没有别的剥法~', '收到！甜的在后头——你先算，算完叫我！'],
  school_girl: ['好，那我先在旁边看会儿书。你慢慢来，我在的。', '嗯，你先学。我把错题本翻一翻，等你忙完再对答案呀。', '去吧，不急。做完记得歇歇眼睛。'],
  che: ['嗯。你学。', '行。我滑两圈，回头见。', '板收了。你先来。'],
  luyi: ['请允许我告退片刻——你与这道题，需要独处。', '那我先去润色笔记了。愿你的思路，如约而至。', '失陪片刻。搞定了记得唤我，我备好茶点等好消息。'],
  yue: ['收到！你打上半场，我先热身！', '好嘞！三、二、一——你上！我场边等！', '行！你主攻，我替补席待命，喊我随时进场！'],
  nailong: ['哼，本龙才不是走，是战略性撤退！你快学！', '行吧行吧……（小声）学会了记得叫我，那道题我还惦记呢。', '呜，那我先撤了。你敢学会不告诉我！'],
  naiwa: ['嘿嘿，那我先回去喂乌龟了~', '没事没事，你先忙，我笑一会儿等你。', '呱……那我趴着眯会儿，你学会了碰碰我。'],
  default: ['你先学，我下次再来找你~', '那我先去忙啦，搞定了叫我！'],
}

/** 科目简称（求教泡/聊天文案用）：题库科目写法多样（如「高等数学（微积分）」），按包含关系匹配，未命中用原名 */
const SUBJECT_SHORT_RULES = [
  ['高等数学', '高数'], ['数学分析', '高数'], ['微积分', '高数'],
  ['线性代数', '线代'],
  ['大学物理', '大物'],
  ['概率论', '概率统计'],
  ['数据结构', '数据结构'], ['算法', '数据结构'],
  ['计算机网络', '计网'],
  ['组成原理', '计组'],
  ['操作系统', '操作系统'],
  ['C语言', 'C语言'],
  ['Python', 'Python'],
  ['信号与系统', '信号与系统'],
  ['复变', '复变函数'],
  ['数字电路', '数电'],
  ['电路分析', '电路'],
  ['离散数学', '离散数学'],
  ['数学物理方程', '数理方程'],
  ['化学', '化学'],
  ['理论力学', '理论力学'],
  ['自动控制', '自控'],
  ['计算机', '计算机'],
]
export function subjectShort(subject) {
  const s = String(subject || '').trim()
  if (!s) return ''
  for (const [p, short] of SUBJECT_SHORT_RULES) {
    if (s.includes(p)) return short
  }
  return s.length > 6 ? s.slice(0, 6) : s
}

/** zy-comp- 前缀的 localStorage 读写（行走层/伙伴页共用同一批 key） */
export const compLs = {
  get: (k, d) => { try { return localStorage.getItem('zy-comp-' + k) ?? d } catch { return d } },
  set: (k, v) => { try { localStorage.setItem('zy-comp-' + k, v) } catch { /* ignore */ } },
}

/* ---------------- 造角色二期：用户自定义伴学角色（2026-10-06） ----------------
 * 登录后从 /api/companion/custom/list 拉取，写入本共享 ref；
 * 行走层与伙伴页经 findCharCfg() 统一取配置，两端自动同步（同一模块实例）。
 * 自定义角色形状与 CHARACTERS 同构：无 walkFrames → 引擎自动瞬移(magic 特效)、
 * faces 为空 → 表情差分回退立绘、lines 为 LLM 生成专属台词（空则前端 default 兜底池）。 */
import { ref } from 'vue'
import { isLoggedIn } from '../auth.js'

/* ---------------- 自定义角色本地缓存（2026-10-13 修「首帧闪成默认角色」） ----------------
 * 自定义角色(cu_*)的配置只在云端，登录后 /api/companion/custom/list 返回前 customChars 是空的，
 * findCharCfg 找不到 → cfg 兜底成 CHARACTERS[0]（荔枝）→ 首帧先画荔枝、云端回来后突然切换。
 * 这里把最近一次的自定义角色列表镜像到 localStorage，启动时先播种渲染；云端到达后自然覆盖（以云端为准）。 */
const LS_CUSTOM_CACHE = 'zy-comp-custom-cache'

function writeCustomCache() {
  try { localStorage.setItem(LS_CUSTOM_CACHE, JSON.stringify(customChars.value)) } catch { /* 隐私模式等：跳过 */ }
}

/** 退出登录时清掉缓存（避免换个账号登录时，首帧先看到上一个账号的自定义角色） */
export function clearCustomCache() {
  try { localStorage.removeItem(LS_CUSTOM_CACHE) } catch { /* ignore */ }
}

export const customChars = ref([])
export function setCustomChars(list) {
  customChars.value = Array.isArray(list) ? list : []
  writeCustomCache()
}
export function isCustomId(id) { return typeof id === 'string' && id.startsWith('cu_') }
export function findCharCfg(id) {
  return CHARACTERS.find((c) => c.id === id)
    || customChars.value.find((c) => c.id === id)
    || null
}
/** 自定义角色的 LLM 专属台词池：kind ∈ greet/idle/seek/move/quota；无则返回 null（调用方落默认池） */
export function customLines(kind, cfg) {
  const arr = cfg && cfg.lines && Array.isArray(cfg.lines[kind]) ? cfg.lines[kind] : null
  return arr && arr.length ? arr : null
}

/* ---------------- 共享激活角色（2026-10-09 修复切角色不同步） ----------------
 * 此前 CompanionLayer 与 CompanionPage 各自 const activeId = ref(ls.get(...)) 独立实例，
 * 伙伴页切角色后行走层（AppShell 常驻不重建）永远收不到——bug 复现见 _probe_switch_bug.mjs。
 * 现收口为模块级单例 ref：两端 import 同一实例，切换统一走 setActiveCompId（改值 + 落盘）。 */
export const activeId = ref(lsValid(compLs.get('active')))
export function setActiveCompId(id) {
  activeId.value = id
  compLs.set('active', id)
}
function lsValid(v) {
  if (!CHARACTERS.some((c) => c.id === v) && !isCustomId(v)) return CHARACTERS[0].id
  return v
}

/* 启动时把「被隐藏角色」纠正掉：否则列表里藏了，舞台上/行走层还会露出它。
   （伙伴页里随时可以重新选别的角色；清空 HIDDEN_CHAR_IDS 后也能再选回奶龙/奶蛙） */
{
  const eff = effectiveActiveId(activeId.value)
  if (eff !== activeId.value) {
    activeId.value = eff
    compLs.set('active', eff)
  }
}

/* 首帧播种（2026-10-13 修「先显示荔枝、再突然切成用户选的自定义角色」）：
   已登录且激活的是自定义角色、而云端列表尚未返回 → 先用本地缓存渲染，首帧即用户所选。
   云端 /api/companion/custom/list 到达后 setCustomChars 会整体覆盖（以云端为准）；缓存损坏则忽略。 */
try {
  if (isLoggedIn() && isCustomId(activeId.value) && customChars.value.length === 0) {
    const cached = JSON.parse(localStorage.getItem(LS_CUSTOM_CACHE) || 'null')
    if (Array.isArray(cached) && cached.some((c) => c && c.id === activeId.value && typeof c.src === 'string' && c.src)) {
      customChars.value = cached
    }
  }
} catch { /* 隐私模式/缓存损坏：忽略，维持旧行为 */ }

/* ---------------- 伙伴元信息（2026-10-11：伴学页角色卡用） ----------------
 * 性格标签与讲题风格是**展示用短文案**（persona 原文太长），称号按亲密度等级给出。
 * 自定义角色走 companionMetaOf 的兜底。 */
export const COMPANION_META = {
  chibi_girl: { tags: ['元气', '嘴快心软', '吐槽是壳'], style: '水果讲题法 · 剥壳才见甜' },
  school_girl: { tags: ['温柔耐心', '擅长鼓励', '从不催促'], style: '慢慢来 · 拆开看' },
  che: { tags: ['淡定寡言', '行动派', '情绪极稳'], style: '短评式 · 再来一遍' },
  luyi: { tags: ['优雅自信', '讲究措辞', '细节控'], style: '换个说法讲清楚' },
  yue: { tags: ['活力满满', '节拍器', '爱打气'], style: '比赛术语讲学习' },
  nailong: { tags: ['气氛组委员', '沙雕助攻', '笑点前置'], style: '笑着把题讲完' },
  naiwa: { tags: ['捧哏担当', '反应夸张', '情绪价值'], style: '先笑再讲题' },
}

/** 亲密度称号（Lv1 → Lv7，与后端 INTIMACY_MAX_LEVEL=7 对齐） */
export const COMPANION_TITLES = ['初识', '熟络', '搭子', '老友', '默契', '知己', '死党']

export function companionMetaOf(id) {
  return COMPANION_META[id] || { tags: [], style: '' }
}

export function companionTitleOf(level) {
  const lv = Math.min(Math.max(Number(level) || 1, 1), COMPANION_TITLES.length)
  return COMPANION_TITLES[lv - 1]
}
