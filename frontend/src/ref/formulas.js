// 公式速查内容（自建，零 API 成本）
// 每条：{ name 名称, tex 公式（渲染时包成 $$...$$）, note 提示/易错点（可空） }
// tex 统一用 String.raw 书写，避免反斜杠转义；注意不要出现 ${ 序列

export const CALC = {
  key: 'calc',
  name: '高等数学',
  type: 'formula',
  groups: [
    {
      title: '极限与连续',
      items: [
        {
          name: '等价无穷小（x→0）',
          tex: String.raw`\sin x\sim x,\quad \tan x\sim x,\quad \arcsin x\sim x,\quad \arctan x\sim x`,
          note: '「光对，对不出」：\\(1-\\cos x\\sim \\frac{x^2}{2}\\)、\\(\\ln(1+x)\\sim x\\)、\\(e^x-1\\sim x\\)、\\((1+x)^a-1\\sim ax\\)、\\(\\sqrt[n]{1+x}-1\\sim \\frac{x}{n}\\)',
        },
        {
          name: '两个重要极限',
          tex: String.raw`\lim_{x\to 0}\frac{\sin x}{x}=1,\qquad \lim_{x\to\infty}\left(1+\frac{1}{x}\right)^{x}=e,\qquad \lim_{x\to 0}(1+x)^{\frac{1}{x}}=e`,
          note: '幂指函数一律化为 u^v = e^{v\\ln u} 处理，1^\\infty 型先取对数再算',
        },
        {
          name: '泰勒（麦克劳林）展开',
          tex: String.raw`e^x=1+x+\frac{x^2}{2!}+\frac{x^3}{3!}+\cdots,\qquad \ln(1+x)=x-\frac{x^2}{2}+\frac{x^3}{3}-\cdots`,
          note: '\\sin x=x-\\frac{x^3}{3!}+\\frac{x^5}{5!}-\\cdots,\\ \\cos x=1-\\frac{x^2}{2!}+\\frac{x^4}{4!}-\\cdots,\\ (1+x)^a=1+ax+\\frac{a(a-1)}{2!}x^2+\\cdots,\\ \\frac{1}{1-x}=1+x+x^2+\\cdots',
        },
        {
          name: '洛必达法则',
          tex: String.raw`\lim_{x\to a}\frac{f(x)}{g(x)}=\lim_{x\to a}\frac{f'(x)}{g'(x)}\qquad\left(\frac{0}{0}\ \text{或}\ \frac{\infty}{\infty}\right)`,
          note: '每用一步都要验证条件；0·∞、∞-∞、1^∞、0^0、∞^0 先转化为 0/0 或 ∞/∞ 再洛',
        },
        {
          name: '无穷小的阶与替换原则',
          tex: String.raw`\beta=o(\alpha)\ \Leftrightarrow\ \lim\frac{\beta}{\alpha}=0;\qquad \alpha\sim\beta\ \Leftrightarrow\ \lim\frac{\alpha}{\beta}=1`,
          note: '乘除可整体替换；加减替换需保证替换后主部未被抵消（保险做法是泰勒展到足够阶）',
        },
        {
          name: '夹逼准则与单调有界准则',
          tex: String.raw`g(x)\le f(x)\le h(x),\ \lim g=\lim h=A\ \Longrightarrow\ \lim f=A`,
          note: '数列极限「单调有界必收敛」常用来证明递推数列收敛，先证界再证单调',
        },
        {
          name: '常用极限结论',
          tex: String.raw`\lim_{x\to 0}\frac{a^x-1}{x}=\ln a,\qquad \lim_{n\to\infty}\sqrt[n]{n}=1,\qquad \lim_{x\to+\infty}\frac{x^k}{e^{x}}=0,\qquad \lim_{x\to+\infty}\frac{\ln x}{x}=0`,
          note: '指数增长 > 幂函数增长 > 对数增长，比较阶时直接用',
        },
        {
          name: '连续与间断点分类',
          tex: String.raw`\text{连续}:\ \lim_{x\to x_0^-}f=\lim_{x\to x_0^+}f=f(x_0)`,
          note: '第一类：可去（左右极限存在且相等但不等于函数值）、跳跃（左右极限不等）；第二类：无穷、振荡',
        },
      ],
    },
    {
      title: '导数与微分',
      items: [
        {
          name: '基本导数表',
          tex: String.raw`(x^a)'=ax^{a-1},\quad (a^x)'=a^x\ln a,\quad (\log_a x)'=\frac{1}{x\ln a},\quad (\sin x)'=\cos x,\quad (\cos x)'=-\sin x`,
          note: '(\\tan x)\'=\\sec^2x,\\ (\\cot x)\'=-\\csc^2x,\\ (\\sec x)\'=\\sec x\\tan x,\\ (\\arcsin x)\'=\\frac{1}{\\sqrt{1-x^2}},\\ (\\arctan x)\'=\\frac{1}{1+x^2}',
        },
        {
          name: '四则运算与链式法则',
          tex: String.raw`(uv)'=u'v+uv',\qquad \left(\frac{u}{v}\right)'=\frac{u'v-uv'}{v^2},\qquad \frac{dy}{dx}=\frac{dy}{du}\cdot\frac{du}{dx}`,
          note: '复合函数层层剥：从外到内，每层乘上内层导数',
        },
        {
          name: '隐函数与参数方程求导',
          tex: String.raw`F(x,y)=0\ \Longrightarrow\ y'=-\frac{F_x}{F_y};\qquad \begin{cases}x=\varphi(t)\\ y=\psi(t)\end{cases}\Longrightarrow\ \frac{dy}{dx}=\frac{\psi'(t)}{\varphi'(t)}`,
          note: '隐函数直接两边对 x 求导、把 y 当 x 的函数解出 y′，通常比套公式更稳',
        },
        {
          name: '高阶导数常用结果',
          tex: String.raw`(e^{ax})^{(n)}=a^ne^{ax},\quad (\sin x)^{(n)}=\sin\!\left(x+n\frac{\pi}{2}\right),\quad \left(\frac{1}{1+x}\right)^{(n)}=\frac{(-1)^nn!}{(1+x)^{n+1}}`,
          note: '乘积高阶导用莱布尼茨公式 (uv)^{(n)}=\\sum_{k=0}^{n}\\binom{n}{k}u^{(k)}v^{(n-k)}',
        },
        {
          name: '微分中值定理',
          tex: String.raw`f(b)-f(a)=f'(\xi)(b-a);\qquad \frac{f(b)-f(a)}{g(b)-g(a)}=\frac{f'(\xi)}{g'(\xi)}`,
          note: '罗尔（f(a)=f(b) 时存在 f′(ξ)=0）→ 拉格朗日 → 柯西，证明题里最常用的是「构造辅助函数再用罗尔」',
        },
        {
          name: '泰勒公式（带余项）',
          tex: String.raw`f(x)=\sum_{k=0}^{n}\frac{f^{(k)}(x_0)}{k!}(x-x_0)^k+\frac{f^{(n+1)}(\xi)}{(n+1)!}(x-x_0)^{n+1}`,
          note: '证明不等式用拉格朗日余项（可定号）；求极限用佩亚诺余项 o((x-x_0)^n)',
        },
        {
          name: '单调性、极值、凹凸与拐点',
          tex: String.raw`f'>0\ \text{增},\ f'<0\ \text{减};\qquad f''>0\ \text{凹(上凹)},\ f''<0\ \text{凸};\qquad f''\ \text{变号处为拐点}`,
          note: '极值判别：f′(x₀)=0 且 f″(x₀)<0 为极大，>0 为极小；f″=0 不一定是拐点（要看变号）',
        },
        {
          name: '渐近线',
          tex: String.raw`\text{斜渐近线}:\ k=\lim_{x\to\infty}\frac{f(x)}{x},\ b=\lim_{x\to\infty}[f(x)-kx],\ y=kx+b`,
          note: '先找无定义点看垂直渐近线，再算水平/斜（k=0 即水平）',
        },
        {
          name: '曲率与曲率半径',
          tex: String.raw`K=\frac{|y''|}{(1+y'^2)^{3/2}},\qquad R=\frac{1}{K}`,
          note: '参数方程形式 K=\\frac{|\\varphi\'\\psi\'\'-\\varphi\'\'\\psi\'|}{(\\varphi\'^2+\\psi\'^2)^{3/2}}',
        },
      ],
    },
    {
      title: '一元函数积分',
      items: [
        {
          name: '基本积分表（必背）',
          tex: String.raw`\int x^a dx=\frac{x^{a+1}}{a+1}+C\ (a\ne-1),\quad \int\frac{dx}{x}=\ln|x|+C,\quad \int e^xdx=e^x+C,\quad \int a^xdx=\frac{a^x}{\ln a}+C`,
          note: '\\int\\sin x\\,dx=-\\cos x+C,\\ \\int\\cos x\\,dx=\\sin x+C,\\ \\int\\sec^2x\\,dx=\\tan x+C,\\ \\int\\frac{dx}{1+x^2}=\\arctan x+C,\\ \\int\\frac{dx}{\\sqrt{1-x^2}}=\\arcsin x+C',
        },
        {
          name: '含参数的常用积分',
          tex: String.raw`\int\frac{dx}{a^2+x^2}=\frac{1}{a}\arctan\frac{x}{a}+C,\quad \int\frac{dx}{\sqrt{a^2-x^2}}=\arcsin\frac{x}{a}+C,\quad \int\frac{dx}{x^2-a^2}=\frac{1}{2a}\ln\left|\frac{x-a}{x+a}\right|+C`,
          note: '\\int\\frac{dx}{\\sqrt{x^2\\pm a^2}}=\\ln\\left|x+\\sqrt{x^2\\pm a^2}\\right|+C,\\ \\int\\tan x\\,dx=-\\ln|\\cos x|+C',
        },
        {
          name: '换元法（含三角代换）',
          tex: String.raw`\int f(\varphi(x))\varphi'(x)\,dx=\int f(u)\,du;\qquad \sqrt{a^2-x^2}\to x=a\sin t,\ \ \sqrt{a^2+x^2}\to x=a\tan t,\ \ \sqrt{x^2-a^2}\to x=a\sec t`,
          note: '换元后一定要换回原变量（定积分换元则同步换限，不必换回）',
        },
        {
          name: '分部积分',
          tex: String.raw`\int u\,dv=uv-\int v\,du`,
          note: '口诀「反对幂指三」：排序靠后的先凑进微分（如 ∫x eˣdx 取 u=x, dv=eˣdx）',
        },
        {
          name: '变限积分求导',
          tex: String.raw`\frac{d}{dx}\int_{a(x)}^{b(x)}f(t)\,dt=f(b(x))\,b'(x)-f(a(x))\,a'(x)`,
          note: '被积函数含 x 时要先换元把 x 移出去再求导',
        },
        {
          name: '定积分性质与中值定理',
          tex: String.raw`\int_a^bf(x)dx=F(b)-F(a);\qquad \int_a^bf(x)\,dx=f(\xi)(b-a),\ \xi\in[a,b]`,
          note: '保号性、估值、区间可加是证明题主力；积分中值定理常与极限结合',
        },
        {
          name: '对称与周期性技巧',
          tex: String.raw`\int_{-a}^{a}f\,dx=\begin{cases}0,&f\ \text{奇}\\ 2\int_0^{a}f\,dx,&f\ \text{偶}\end{cases}`,
          note: '周期为 T 时 \\int_a^{a+T}f=\\int_0^Tf；常配 x\\to a+b-x 的区间再现换元（如 \\int_0^{\\pi}x f(\\sin x)dx）',
        },
        {
          name: 'Wallis（点火）公式',
          tex: String.raw`\int_0^{\frac{\pi}{2}}\sin^n x\,dx=\int_0^{\frac{\pi}{2}}\cos^n x\,dx=\begin{cases}\frac{n-1}{n}\cdot\frac{n-3}{n-2}\cdots\frac{1}{2}\cdot\frac{\pi}{2},&n\ \text{偶}\\[2mm]\frac{n-1}{n}\cdot\frac{n-3}{n-2}\cdots\frac{2}{3},&n\ \text{奇}\end{cases}`,
          note: '先凑成 0 到 π/2 的形式再用；对称区间 + 奇偶性经常配合使用',
        },
        {
          name: '有理函数与三角有理式',
          tex: String.raw`\int \frac{P_n(x)}{Q_m(x)}dx\ \text{→ 部分分式;} \qquad \int R(\sin x,\cos x)dx\ \xrightarrow{t=\tan\frac{x}{2}} \int \frac{2}{1+t^2}R\!\left(\frac{2t}{1+t^2},\frac{1-t^2}{1+t^2}\right)dt`,
          note: '万能代换是兜底方案，能用凑微分/积化和差就优先用，避免复杂有理式',
        },
        {
          name: '反常积分与 Γ 函数',
          tex: String.raw`\int_1^{\infty}\frac{dx}{x^p}\ \text{收敛}\Leftrightarrow p>1;\qquad \int_0^{1}\frac{dx}{x^p}\ \text{收敛}\Leftrightarrow p<1;\qquad \Gamma(n+1)=n!,\ \Gamma\!\left(\tfrac12\right)=\sqrt{\pi}`,
          note: '判别用比较法：与 p 积分比；Γ 函数可秒算 \\int_0^\\infty x^ne^{-x}dx=n!',
        },
        {
          name: '定积分的几何应用',
          tex: String.raw`S=\int_a^b|f|\,dx;\quad V_x=\pi\int_a^bf^2dx;\quad V_y=2\pi\int_a^bx|f|\,dx;\quad s=\int_a^b\sqrt{1+y'^2}\,dx`,
          note: '旋转体另有两种思路：绕 x 轴用圆盘法，绕 y 轴用柱壳法（看哪种积分好算）；曲面面积用 S=2\\pi\\int|f|\\sqrt{1+y\'^2}dx',
        },
        {
          name: '形心与转动惯量',
          tex: String.raw`\bar{x}=\frac{1}{A}\int_a^b x|f|dx,\qquad I_y=\int_a^bx^2|f(x)|dx`,
          note: '物理应用题先画图、写微元 dA 或 dV，再化成定积分',
        },
      ],
    },
    {
      title: '多元微分学',
      items: [
        {
          name: '偏导数与全微分',
          tex: String.raw`dz=\frac{\partial z}{\partial x}dx+\frac{\partial z}{\partial y}dy;\qquad \frac{\partial^2 z}{\partial x\partial y}=\frac{\partial^2 z}{\partial y\partial x}\ (\text{连续时})`,
          note: '可微 ⇒ 偏导存在 ⇒ 连续，反向都不成立；判断可微用 \\lim\\frac{\\Delta z-dz}{\\rho}=0',
        },
        {
          name: '复合函数求导（链式法则）',
          tex: String.raw`z=f(u,v),\ u=u(x,y),\ v=v(x,y)\ \Longrightarrow\ \frac{\partial z}{\partial x}=\frac{\partial f}{\partial u}\frac{\partial u}{\partial x}+\frac{\partial f}{\partial v}\frac{\partial v}{\partial x}`,
          note: '画变量关系树，每条路径相乘、各路径相加，不易错',
        },
        {
          name: '隐函数求导公式',
          tex: String.raw`\frac{\partial z}{\partial x}=-\frac{F_x}{F_z},\qquad \frac{\partial z}{\partial y}=-\frac{F_y}{F_z}\qquad(F(x,y,z)=0)`,
          note: '求二阶偏导时，把 z 视为 x,y 的函数继续求导，别漏 F_x 里隐含的 z',
        },
        {
          name: '方向导数与梯度',
          tex: String.raw`\frac{\partial f}{\partial \vec{l}}=\nabla f\cdot \vec{e}_l=|\nabla f|\cos\theta;\qquad \nabla f=(f_x,f_y,f_z)`,
          note: '梯度方向是增长最快的方向，模是最大变化率；沿梯度的方向导数取到最大值',
        },
        {
          name: '几何应用：切平面与法线',
          tex: String.raw`F_x(x_0)(x-x_0)+F_y(y_0)(y-y_0)+F_z(z_0)(z-z_0)=0`,
          note: '曲面 F=0 的法向量 (F_x,F_y,F_z)；曲线参数式的切向量 (φ′,ψ′,ω′)；切平面也可写成 z-z_0=f_x(x-x_0)+f_y(y-y_0)',
        },
        {
          name: '无条件极值判别（AC-B²）',
          tex: String.raw`A=f_{xx},\ B=f_{xy},\ C=f_{yy};\quad AC-B^2>0\Rightarrow\text{极值}(A>0\ \text{极小},\ A<0\ \text{极大});\quad <0\Rightarrow\text{非极值}`,
          note: '先解 f_x=f_y=0 求驻点；AC-B²=0 时判别失效，需另想办法',
        },
        {
          name: '条件极值：拉格朗日乘数法',
          tex: String.raw`L(x,y,\lambda)=f(x,y)+\lambda\,\varphi(x,y);\qquad \begin{cases}L_x=0\\ L_y=0\\ \varphi=0\end{cases}`,
          note: '多个约束就多个乘子；实际问题可结合边界与几何意义判断是最大还是最小',
        },
        {
          name: '有界闭区域上的最值',
          tex: String.raw`z_{\max}=\max\{\text{内部驻点值},\ \text{边界上的最值}\}`,
          note: '边界用代入法降为一元函数，或用参数化；千万别漏边界',
        },
      ],
    },
    {
      title: '重积分与曲线曲面积分',
      items: [
        {
          name: '二重积分（直角与极坐标）',
          tex: String.raw`\iint_D f\,dxdy=\int_\alpha^\beta\!\!\int_{r_1(\theta)}^{r_2(\theta)}f(r\cos\theta,r\sin\theta)\,r\,dr\,d\theta`,
          note: '区域是圆/扇形/环形优先极坐标；别忘了 Jacobi 因子 r',
        },
        {
          name: '三重积分（柱面与球面坐标）',
          tex: String.raw`\text{柱面}: dV=r\,dr\,d\theta\,dz;\qquad \text{球面}: dV=\rho^2\sin\varphi\,d\rho\,d\varphi\,d\theta`,
          note: '含 x²+y²+z² 用球面，含 x²+y² 用柱面；投影法定限最稳',
        },
        {
          name: '曲线积分（两类）',
          tex: String.raw`\int_L f(x,y)\,ds=\int_a^b f(\varphi(t),\psi(t))\sqrt{\varphi'^2+\psi'^2}\,dt;\qquad \int_L P\,dx+Q\,dy=\int_a^b\!\left(P\varphi'+Q\psi'\right)dt`,
          note: '第一类与方向无关；第二类与方向有关（反向变号）',
        },
        {
          name: '格林公式',
          tex: String.raw`\oint_L P\,dx+Q\,dy=\iint_D\left(\frac{\partial Q}{\partial x}-\frac{\partial P}{\partial y}\right)dx\,dy`,
          note: 'L 取正向（区域在左侧）；有奇点先挖去小圆；\\frac{\\partial Q}{\\partial x}=\\frac{\\partial P}{\\partial y} 时积分与路径无关（存在 u 使 du=Pdx+Qdy）',
        },
        {
          name: '第一、二类曲面积分',
          tex: String.raw`\iint_\Sigma f\,dS=\iint_{D_{xy}}f(x,y,z(x,y))\sqrt{1+z_x^2+z_y^2}\,dxdy;\qquad \iint_\Sigma R\,dxdy=\pm\iint_{D_{xy}}R\,dxdy`,
          note: '第二类取 + 还是 − 取决于法向量与坐标轴夹角（上侧取正）',
        },
        {
          name: '高斯公式',
          tex: String.raw`\oiint_\Sigma P\,dydz+Q\,dzdx+R\,dxdy=\iiint_\Omega\left(\frac{\partial P}{\partial x}+\frac{\partial Q}{\partial y}+\frac{\partial R}{\partial z}\right)dV`,
          note: 'Σ 取外侧；不闭合就补面（通常补平面，注意补面那一份要减掉）',
        },
        {
          name: '斯托克斯公式',
          tex: String.raw`\oint_\Gamma P\,dx+Q\,dy+R\,dz=\iint_\Sigma \mathrm{rot}\,\vec{F}\cdot d\vec{S}`,
          note: '\\mathrm{rot}\\vec{F}=(R_y-Q_z,\\ P_z-R_x,\\ Q_x-P_y)；平面曲线直接用格林公式更快',
        },
        {
          name: '体积与曲面面积',
          tex: String.raw`V=\iiint_\Omega dV;\qquad A=\iint_D\sqrt{1+z_x^2+z_y^2}\,dxdy`,
          note: '旋转体/柱体也可用「先一后二、先二后一」灵活选择积分次序',
        },
      ],
    },
    {
      title: '无穷级数',
      items: [
        {
          name: '三个基准级数',
          tex: String.raw`\sum_{n=1}^{\infty}aq^n\ \text{收敛}\Leftrightarrow|q|<1;\qquad \sum\frac{1}{n^p}\ \text{收敛}\Leftrightarrow p>1;\qquad \sum\frac{1}{n\ln^pn}\ \text{收敛}\Leftrightarrow p>1`,
          note: '比较判别法都是拿它们当标尺；调和级数 \\sum 1/n 发散是最常用的反例',
        },
        {
          name: '正项级数判别法',
          tex: String.raw`\text{比值}:\lim\frac{u_{n+1}}{u_n}=l;\qquad \text{根值}:\lim\sqrt[n]{u_n}=l;\qquad l<1\ \text{收敛},\ l>1\ \text{发散}`,
          note: 'l=1 时失效（此时改用比较或积分判别）；含 n!、a^n 优先比值，含 n 次方优先根值',
        },
        {
          name: '交错级数与绝对收敛',
          tex: String.raw`\sum(-1)^{n-1}u_n\ (u_n\downarrow 0)\ \text{收敛（莱布尼茨）}`,
          note: '绝对收敛 ⇒ 收敛；条件收敛（如 \\sum(-1)^n/n）只能靠莱布尼茨，且重新排列可能改变和',
        },
        {
          name: '幂级数收敛半径',
          tex: String.raw`R=\lim_{n\to\infty}\left|\frac{a_n}{a_{n+1}}\right|\quad\text{或}\quad R=\frac{1}{\lim\sqrt[n]{|a_n|}}`,
          note: '端点必须单独判别（常出现一端收敛一端发散）；缺项级数直接用比值法对 x 求',
        },
        {
          name: '常用幂级数展开',
          tex: String.raw`\frac{1}{1-x}=\sum_{n=0}^\infty x^n\ (|x|<1),\quad e^x=\sum\frac{x^n}{n!},\quad \ln(1+x)=\sum_{n=1}^\infty(-1)^{n-1}\frac{x^n}{n}\ (x\in(-1,1])`,
          note: '\\sin x=\\sum\\frac{(-1)^nx^{2n+1}}{(2n+1)!},\\ \\cos x=\\sum\\frac{(-1)^nx^{2n}}{(2n)!},\\ \\arctan x=\\sum\\frac{(-1)^nx^{2n+1}}{2n+1}\\ (|x|\\le1)',
        },
        {
          name: '求和函数三板斧',
          tex: String.raw`\sum_{n=1}^\infty nx^{n-1}=\frac{1}{(1-x)^2}\ (|x|<1);\qquad \sum_{n=0}^\infty\frac{x^n}{n!}=e^x`,
          note: '① 拆项凑成已知展开 ② 逐项积分/求导后再求和 ③ 先求导再积分还原（注意常数项）',
        },
        {
          name: '傅里叶级数（周期 2π）',
          tex: String.raw`f(x)\sim\frac{a_0}{2}+\sum_{n=1}^\infty(a_n\cos nx+b_n\sin nx),\quad a_n=\frac{1}{\pi}\int_{-\pi}^{\pi}f\cos nx\,dx,\quad b_n=\frac{1}{\pi}\int_{-\pi}^{\pi}f\sin nx\,dx`,
          note: '奇函数只留 sin（正弦级数），偶函数只留 cos；逐点收敛到 \\frac{f(x^-)+f(x^+)}{2}（跳跃点取平均）',
        },
        {
          name: '周期 2l 与狄利克雷定理',
          tex: String.raw`a_n=\frac{1}{l}\int_{-l}^{l}f(x)\cos\frac{n\pi x}{l}dx,\qquad b_n=\frac{1}{l}\int_{-l}^{l}f(x)\sin\frac{n\pi x}{l}dx`,
          note: '记法：把 \\frac{\\pi x}{l} 当作变量；间断点收敛到左右极限平均值，这是求特殊级数和（如 \\sum 1/n^2）的常用手段',
        },
      ],
    },
    {
      title: '微分方程',
      items: [
        {
          name: '可分离变量方程',
          tex: String.raw`\frac{dy}{dx}=f(x)g(y)\ \Longrightarrow\ \int\frac{dy}{g(y)}=\int f(x)\,dx`,
          note: '注意 g(y)=0 的常数解可能被除法丢掉',
        },
        {
          name: '齐次方程',
          tex: String.raw`\frac{dy}{dx}=f\!\left(\frac{y}{x}\right)\ \xrightarrow{u=\frac{y}{x}}\ x\frac{du}{dx}+u=f(u)`,
          note: '判据：分子分母同次；化为可分离变量后用 u 积分，最后换回 y/x',
        },
        {
          name: '一阶线性方程通解公式',
          tex: String.raw`y'+P(x)y=Q(x)\ \Longrightarrow\ y=e^{-\int P\,dx}\left(\int Q\,e^{\int P\,dx}dx+C\right)`,
          note: '先化成标准形（y′ 系数为 1）再套；记忆法：一边乘 e^{∫P} 凑成 (ye^{∫P})′ = Qe^{∫P}',
        },
        {
          name: '伯努利方程',
          tex: String.raw`y'+P(x)y=Q(x)y^n\ (n\ne0,1)\ \xrightarrow{z=y^{1-n}}\ z'+(1-n)Pz=(1-n)Q`,
          note: 'n>0 时 y=0 也是解，别丢',
        },
        {
          name: '可降阶的二阶方程',
          tex: String.raw`y''=f(x):\ \text{两次积分};\quad y''=f(x,y')\ \xrightarrow{p=y'};\quad y''=f(y,y')\ \xrightarrow{p=y',\ y''=p\frac{dp}{dy}}`,
          note: '缺 y 用 p=y′（对 x）；缺 x 用 p 对 y 求导，这是最典型的两种换法',
        },
        {
          name: '二阶常系数齐次方程',
          tex: String.raw`y''+py'+qy=0,\ \ r^2+pr+q=0:\ \ \begin{cases}r_1\ne r_2:& y=C_1e^{r_1x}+C_2e^{r_2x}\\ r_1=r_2:& y=(C_1+C_2x)e^{rx}\\ r=\alpha\pm\beta i:& y=e^{\alpha x}(C_1\cos\beta x+C_2\sin\beta x)\end{cases}`,
          note: '先解特征方程，三种情况分别对应；虚根时记得带 e^{αx}',
        },
        {
          name: '二阶常系数非齐次（待定系数）',
          tex: String.raw`f(x)=e^{\lambda x}P_m(x)\ \Rightarrow\ y^*=x^k e^{\lambda x}Q_m(x)`,
          note: 'k = λ 作为特征根的重数（0/1/2）；若 f 含三角项，用 e^{λx}(A\\cos\\omega x+B\\sin\\omega x) 形式，λ±ωi 是根则乘 x^k',
        },
        {
          name: '欧拉方程',
          tex: String.raw`x^2y''+pxy'+qy=f(x)\ \xrightarrow{x=e^t}\ \frac{d^2y}{dt^2}+(p-1)\frac{dy}{dt}+qy=f(e^t)`,
          note: 'x<0 时取 |x|；化完按常系数二阶处理，最后换回 x',
        },
        {
          name: '一阶差分方程（补充）',
          tex: String.raw`y_{t+1}-ay_t=b\ \Longrightarrow\ y_t=C a^t+\frac{b}{1-a}\ (a\ne1)`,
          note: '形式上与一阶线性方程一致，把求导换成差分即可',
        },
      ],
    },
  ],
}

export const LINEAR = {
  key: 'linear',
  name: '线性代数',
  type: 'formula',
  groups: [
    {
      title: '行列式与矩阵',
      items: [
        {
          name: '行列式基本性质',
          tex: String.raw`|A^T|=|A|;\qquad |kA|=k^n|A|;\qquad |AB|=|A||B|`,
          note: '交换两行变号、某行乘 k 则整体乘 k、行倍加不变——用这三条把行列式化成三角',
        },
        {
          name: '按行（列）展开与范德蒙德',
          tex: String.raw`|A|=\sum_{j=1}^{n}a_{ij}A_{ij};\qquad V_n=\prod_{1\le i<j\le n}(x_j-x_i)`,
          note: 'A_{ij} 是代数余子式 (A_{ij}=(-1)^{i+j}M_{ij})；Vandermonde 常见于插值与特征值题',
        },
        {
          name: '逆矩阵与伴随矩阵',
          tex: String.raw`AA^*=A^*A=|A|E;\qquad A^{-1}=\frac{1}{|A|}A^*\quad(|A|\ne0);\qquad (AB)^{-1}=B^{-1}A^{-1}`,
          note: 'A^* 的每个元素是「转置后的代数余子式」，顺序别写反；(|A|E)^{-1} 类题常用 A A^* = |A| E 过渡',
        },
        {
          name: '秩的性质',
          tex: String.raw`r(A)=r(A^T);\qquad r(AB)\le\min\{r(A),r(B)\};\qquad r(A+B)\le r(A)+r(B)`,
          note: 'A 可逆时 r(AB)=r(B)；r(A)=n ⇔ |A|≠0 ⇔ 列向量线性无关；常与方程组解的判定连用',
        },
        {
          name: '初等行变换求逆与解方程',
          tex: String.raw`[A\mid E]\xrightarrow{\ \text{行变换}\ }[E\mid A^{-1}];\qquad [A\mid B]\xrightarrow{\ \text{行变换}\ }\text{行最简形}`,
          note: '只能行变换（求逆时不能列变换）；解方程用行最简形直接读出解',
        },
        {
          name: '克拉默法则',
          tex: String.raw`x_j=\frac{|A_j|}{|A|}\qquad(|A|\ne0)`,
          note: 'A_j 是把 A 的第 j 列换成常数列 b；只适用于方程个数=未知数个数且 |A|≠0',
        },
        {
          name: '分块矩阵求逆',
          tex: String.raw`\begin{pmatrix}A&0\\0&B\end{pmatrix}^{-1}=\begin{pmatrix}A^{-1}&0\\0&B^{-1}\end{pmatrix},\qquad \begin{pmatrix}0&A\\B&0\end{pmatrix}^{-1}=\begin{pmatrix}0&B^{-1}\\A^{-1}&0\end{pmatrix}`,
          note: '上（下）三角分块的逆保持同型，非零块逐个求逆并调整位置',
        },
      ],
    },
    {
      title: '向量组与线性方程组',
      items: [
        {
          name: '线性相关判定',
          tex: String.raw`\alpha_1,\dots,\alpha_s\ (\alpha_1\ne0)\ \text{线性相关}\ \Leftrightarrow\ \text{存在}\ \alpha_i\ \text{可由其余线性表示}`,
          note: '含零向量必相关；部分相关则整体相关；向量个数 > 维数必相关；整体无关则部分无关',
        },
        {
          name: '极大无关组与秩',
          tex: String.raw`r(\alpha_1,\dots,\alpha_s)=\text{极大无关组中向量个数}=\text{矩阵的秩}`,
          note: '把向量按列（或按行，看题目问法）拼成矩阵，行最简形中主元所在列即极大无关组',
        },
        {
          name: '齐次方程组解的结构',
          tex: String.raw`Ax=0:\ \text{基础解系含}\ n-r(A)\ \text{个解},\qquad x=k_1\xi_1+\cdots+k_{n-r}\xi_{n-r}`,
          note: 'n 是未知数个数；只有零解 ⇔ r(A)=n；基础解系必须线性无关且个数正好 n-r(A)',
        },
        {
          name: '非齐次方程组',
          tex: String.raw`Ax=b\ \text{有解}\Leftrightarrow r(A)=r(\bar A);\qquad x=\eta+\sum k_i\xi_i`,
          note: '唯一解 ⇔ r(A)=r(Ā)=n；无穷多解 ⇔ r(A)=r(Ā)<n；通解=特解+齐次通解',
        },
        {
          name: '内积、夹角、正交',
          tex: String.raw`(\alpha,\beta)=\sum a_ib_i;\qquad \cos\theta=\frac{(\alpha,\beta)}{|\alpha||\beta|};\qquad (\alpha,\beta)=0\Leftrightarrow \text{正交}`,
          note: '正交矩阵满足 Q^TQ=E（即 Q^{-1}=Q^T），其行列式为 ±1，且保持长度与内积',
        },
        {
          name: '施密特正交化',
          tex: String.raw`\beta_1=\alpha_1,\qquad \beta_k=\alpha_k-\sum_{i=1}^{k-1}\frac{(\alpha_k,\beta_i)}{(\beta_i,\beta_i)}\beta_i`,
          note: '再单位化得标准正交组；实对称矩阵的相似对角化题必用',
        },
      ],
    },
    {
      title: '特征值、二次型',
      items: [
        {
          name: '特征值的性质',
          tex: String.raw`\sum_{i=1}^n\lambda_i=\mathrm{tr}(A),\qquad \prod_{i=1}^n\lambda_i=|A|`,
          note: '不同特征值对应的特征向量线性无关；A 可逆时 A^{-1} 特征值为 1/λ，A^k 为 λ^k，f(A) 为 f(λ)',
        },
        {
          name: '相似对角化条件',
          tex: String.raw`A\sim\Lambda\ \Leftrightarrow\ A\ \text{有}\ n\ \text{个线性无关的特征向量}\ \Leftrightarrow\ \text{每个}\ \lambda_i\ \text{的几何重数=代数重数}`,
          note: 'n 个特征值互不相同则必可对角化；实对称矩阵一定可正交对角化（且特征值全为实数）',
        },
        {
          name: '实对称矩阵的正交对角化',
          tex: String.raw`Q^TAQ=\Lambda,\qquad Q^{-1}=Q^T`,
          note: '不同特征值的特征向量已经正交，同一特征值的多个向量做施密特正交化，最后单位化组成 Q',
        },
        {
          name: '二次型标准形与惯性定理',
          tex: String.raw`f=x^TAx\ \xrightarrow{x=Qy}\ y^T(Q^TAQ)y=\lambda_1y_1^2+\cdots+\lambda_ny_n^2`,
          note: '正交变换不改变特征值；配方法得到的标准形不唯一，但正负惯性指数唯一（惯性定理）；规范形中系数只有 1、-1、0',
        },
        {
          name: '正定判别',
          tex: String.raw`f\ \text{正定}\ \Leftrightarrow\ \text{顺序主子式全}>0\ \Leftrightarrow\ \text{特征值全}>0\ \Leftrightarrow\ A\simeq E`,
          note: '必要条件：主对角元全 >0、|A|>0；负定则奇数阶顺序主子式 <0 且偶数阶 >0',
        },
        {
          name: '相似、合同、等价',
          tex: String.raw`\text{等价}:PAQ=B;\quad \text{相似}:P^{-1}AP=B;\quad \text{合同}:C^TAC=B`,
          note: '相似 ⇒ 等价且同秩同迹同行列式（特征值相同）；合同只看正负惯性指数；实对称矩阵「相似 ⇔ 合同」',
        },
      ],
    },
  ],
}

export const PROB = {
  key: 'prob',
  name: '概率论与数理统计',
  type: 'formula',
  groups: [
    {
      title: '概率基础',
      items: [
        {
          name: '古典概型与计数',
          tex: String.raw`P(A)=\frac{\text{有利样本点数}}{\text{样本点总数}};\qquad A_n^m=\frac{n!}{(n-m)!},\quad C_n^m=\frac{n!}{m!(n-m)!}`,
          note: '「至少」类问题用对立事件：P(至少一个)=1-P(一个都没有)',
        },
        {
          name: '条件概率与乘法公式',
          tex: String.raw`P(A\mid B)=\frac{P(AB)}{P(B)};\qquad P(AB)=P(A)P(B\mid A)`,
          note: 'P(B)≠0 才定义；多事件连乘展开 P(A₁A₂A₃)=P(A₁)P(A₂|A₁)P(A₃|A₁A₂)',
        },
        {
          name: '全概率与贝叶斯公式',
          tex: String.raw`P(A)=\sum_i P(B_i)P(A\mid B_i);\qquad P(B_i\mid A)=\frac{P(B_i)P(A\mid B_i)}{\sum_j P(B_j)P(A\mid B_j)}`,
          note: '关键动作：找完备事件组 B₁…B_n（划分）；贝叶斯是「由结果反推原因」',
        },
        {
          name: '独立性与伯努利概型',
          tex: String.raw`A,B\ \text{独立}\Leftrightarrow P(AB)=P(A)P(B);\qquad P_n(k)=C_n^kp^k(1-p)^{n-k}`,
          note: '两两独立 ≠ 相互独立；n 重伯努利中「恰好 k 次」用二项分布',
        },
      ],
    },
    {
      title: '随机变量与分布',
      items: [
        {
          name: '分布函数与密度',
          tex: String.raw`F(x)=P(X\le x);\qquad F(x)=\int_{-\infty}^{x}f(t)\,dt,\qquad f(x)=F'(x)`,
          note: 'F 单调不减、右连续、F(-∞)=0、F(+∞)=1；连续型 P(X=a)=0',
        },
        {
          name: '离散型常见分布',
          tex: String.raw`P(X=k)=C_n^kp^kq^{n-k}\ (\text{二项});\qquad P(X=k)=\frac{\lambda^ke^{-\lambda}}{k!}\ (\text{泊松});\qquad P(X=k)=q^{k-1}p\ (\text{几何})`,
          note: '0-1 分布是二项的特例；泊松常用来近似二项（n 大 p 小，λ=np）',
        },
        {
          name: '连续型常见分布',
          tex: String.raw`f(x)=\frac{1}{b-a}\ (a<x<b);\qquad f(x)=\lambda e^{-\lambda x}\ (x>0);\qquad f(x)=\frac{1}{\sqrt{2\pi}\sigma}e^{-\frac{(x-\mu)^2}{2\sigma^2}}`,
          note: '指数分布无记忆性 P(X>s+t|X>s)=P(X>t)；均匀分布注意区间端点不影响概率',
        },
        {
          name: '正态分布标准化',
          tex: String.raw`X\sim N(\mu,\sigma^2)\ \Longrightarrow\ \frac{X-\mu}{\sigma}\sim N(0,1);\qquad P(|X-\mu|<3\sigma)\approx0.9974`,
          note: '标准正态用 Φ 查表：P(a<X<b)=Φ((b-μ)/σ)-Φ((a-μ)/σ)；Φ(-x)=1-Φ(x)',
        },
        {
          name: '二维分布与独立性',
          tex: String.raw`f_X(x)=\int_{-\infty}^{+\infty}f(x,y)\,dy;\qquad X,Y\ \text{独立}\Leftrightarrow f(x,y)=f_X(x)f_Y(y)`,
          note: '联合分布能推出边缘，反之不然；两正态的线性组合仍正态（需独立才能直接相加方差）',
        },
      ],
    },
    {
      title: '数字特征与统计',
      items: [
        {
          name: '期望与方差性质',
          tex: String.raw`E(aX+b)=aE(X)+b;\qquad D(aX)=a^2D(X);\qquad D(X)=E(X^2)-[E(X)]^2`,
          note: 'E 对加减总是线性；D 只有在独立时才有 D(X±Y)=D(X)+D(Y)（一般情形要加协方差项）',
        },
        {
          name: '协方差与相关系数',
          tex: String.raw`\mathrm{Cov}(X,Y)=E(XY)-E(X)E(Y);\qquad \rho=\frac{\mathrm{Cov}(X,Y)}{\sqrt{D(X)}\sqrt{D(Y)}}`,
          note: '独立 ⇒ 不相关，反之不成立（但对二维正态来说两者等价）；|ρ|≤1',
        },
        {
          name: '常见分布的 E 与 D 速查',
          tex: String.raw`0\text{-}1:\ p,\ pq;\quad \text{二项}:\ np,\ npq;\quad \text{泊松}:\ \lambda,\ \lambda;\quad \text{均匀}:\ \frac{a+b}{2},\ \frac{(b-a)^2}{12}`,
          note: '指数：1/λ 与 1/λ²；正态：μ 与 σ²；几何（次数型）：1/p 与 q/p²',
        },
        {
          name: '大数定律与中心极限定理',
          tex: String.raw`\bar{X}_n\xrightarrow{P}\mu;\qquad \frac{\sum X_i-n\mu}{\sqrt{n}\sigma}\ \xrightarrow{d}\ N(0,1)`,
          note: 'CLT 是「n 个独立同分布变量之和近似正态」的依据，估概率题多用它（注意标准化）',
        },
        {
          name: '常用统计量分布',
          tex: String.raw`\frac{(n-1)S^2}{\sigma^2}\sim\chi^2(n-1);\qquad \frac{\bar{X}-\mu}{S/\sqrt{n}}\sim t(n-1);\qquad \frac{S_1^2/\sigma_1^2}{S_2^2/\sigma_2^2}\sim F(n_1-1,n_2-1)`,
          note: 'μ 未知用 t（用 S 替代 σ）；χ² 用于方差推断；F 用于两方差比',
        },
        {
          name: '矩估计与最大似然估计',
          tex: String.raw`\hat{\mu}_k=\frac{1}{n}\sum X_i^k;\qquad L(\theta)=\prod_{i=1}^nf(x_i;\theta),\qquad \frac{d\ln L}{d\theta}=0`,
          note: 'MLE 三步：写似然 → 取对数 → 求导令 0；参数是区间上界的题，MLE 常取 max{xᵢ}（不能用求导法）',
        },
        {
          name: '区间估计与假设检验',
          tex: String.raw`\mu\in\left[\bar{X}\pm t_{\frac{\alpha}{2}}(n-1)\frac{S}{\sqrt{n}}\right]`,
          note: 'σ 已知用 z 分位、未知用 t；假设检验：写出 H₀/H₁ → 选统计量 → 定拒绝域 → 下结论（两类错误：弃真 α、取伪 β）',
        },
      ],
    },
  ],
}

