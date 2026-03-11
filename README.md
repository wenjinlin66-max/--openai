要将这个项目下载到您的电脑本地运行，您需要搭建一个标准的 React 开发环境。目前的在线编辑器使用的是 CDN 链接引入库，而本地开发通常使用 NPM 来管理依赖包。
以下是详细的保姆级教程，分为 B 端和 C 端两个部分。

---
第一步：准备环境
确保您的电脑上已经安装了以下软件：
1. Node.js: (版本建议 18 或更高) 用于运行 JavaScript 环境。
2. Git: 用于从 GitHub 下载代码。
3. VS Code: 您的代码编辑器。
第二步：下载代码 (Clone)
1. 打开本地的一个文件夹（比如 D:\Projects）。
2. 右键选择 Git Bash Here (或者在命令行中进入该目录)。
3. 输入以下命令将代码下载到本地（替换为您实际的 GitHub 地址）：
4. codeBash
git clone https://github.com/您的用户名/您的仓库名.git
1. 下载完成后，进入该文件夹，右键 -> 通过 Code 打开 (或者在 VS Code 中 文件 -> 打开文件夹 选择该目录)。
第三步：安装依赖 (Install Dependencies)
项目下载下来时通常不包含 node_modules（第三方库），需要自行安装。
1. 在 VS Code 顶部菜单栏选择 终端 (Terminal) -> 新建终端 (New Terminal)。
2. 在下方的命令行中输入：
3. codeBash
npm install
1. (等待进度条走完，这会下载 React、Supabase SDK、Google GenAI SDK 等所有必要的包)
第四步：配置环境变量 (.env)
这是最关键的一步，必须配置 API Key 才能连接 AI 和数据库。
1. 在项目根目录（和 package.json 同级）下，新建一个文件，命名为 .env。
2. 将以下内容复制进去，并填入您自己的真实 Key（根据之前的对话，您应该已经申请好了）：
3. codeEnv
# Google Gemini API Key
API_KEY=

# Supabase 配置 (如果不填，部分功能会报错或使用默认演示配置)
SUPABASE_URL=
SUPABASE_KEY=
1. 注意：文件名前面有个点，没有文件名，只有后缀，叫 .env。不要叫 config.env 或其他名字。
第五步：启动项目 (Run)
1. 在 VS Code 终端中输入启动命令：
2. codeBash
npm run dev
1. (如果 npm run dev 报错，可以尝试 npm start，这取决于项目是 Vite 还是 CRA 架构，通常现在的项目都是 npm run dev)
2. 终端会显示一个本地地址，通常是：
http://localhost:5173 或者 http://localhost:3000
3. 按住 Ctrl 键并点击那个链接，或者直接在浏览器地址栏输入该地址。
总结操作流
Clone 代码 -> npm install -> 建 .env 填 Key -> npm run dev

---
第二部分：搭建 C 端 (顾客小程序)
步骤与 B 端几乎一样，建议新建一个文件夹 crims-customer。
1. 初始化：
2. 运行 C 端：
在 crims-customer 文件夹下运行终端：
3. codeBash
npm run dev
4. Vite 会自动分配另一个端口（例如 http://localhost:5174）。

---
总结与注意事项
1. 两个终端：您需要打开两个终端窗口，一个跑 B 端 (npm run dev)，一个跑 C 端。
2. 数据库连接：因为您用的是 Supabase 云数据库，所以本地运行的代码依然连接的是云端数据，B 端和 C 端的数据依然是互通的，完全不需要改数据库配置。
3. 手机测试 C 端：
  - 确保手机和电脑连在同一个 WiFi 下。
  - 在电脑终端运行 npm run dev -- --host。
  - 终端会显示一个 Network IP（例如 http://192.168.1.5:5174）。
  - 用手机浏览器访问这个 IP，即可在手机上体验 C 端网页。
