# 钱程似金-拯救公主

这是微信小游戏版本的"勇士救公主"游戏。

## 项目结构

```
minigame/
├── game.js              # 入口文件
├── game.json            # 小游戏配置
├── project.config.json  # 项目配置
├── js/
│   ├── main.js          # 主游戏逻辑
│   ├── audio.js         # 音频管理
│   └── classes.js       # 游戏类（勇士、敌人、平台等）
├── audio/
│   └── bg.mp3           # 背景音乐（需要从 static/assets/music/ 复制）
└── images/              # 图片资源（可选）
```

## 使用方法

### 1. 复制资源文件

将以下文件复制到 `minigame/audio/` 目录：

```bash
cp ../static/assets/music/bg.mp3 audio/
```

### 2. 使用微信开发者工具打开

1. 打开微信开发者工具
2. 选择"小游戏"项目
3. 导入项目，选择 `minigame` 目录
4. 填写 AppID（或使用测试号）

### 3. 预览和调试

- 在微信开发者工具中点击"编译"
- 可以在模拟器中预览游戏
- 点击"预览"可以在手机上测试

## 与小程序版的区别

| 特性 | 小程序版 (uni-app)          | 小游戏版                   |
| ---- | --------------------------- | -------------------------- |
| 框架 | Vue.js + uni-app            | 原生 JS                    |
| 渲染 | uni-app Canvas              | 原生 Canvas                |
| UI   | HTML/CSS                    | Canvas 绘制                |
| 音频 | uni.createInnerAudioContext | wx.createInnerAudioContext |
| 触摸 | uni 事件                    | wx.onTouchStart 等         |

## 游戏玩法

- **左/右按钮**: 移动勇士
- **B 按钮**: 跳跃
- **A 按钮**: 攻击

目标：穿越重重关卡，救出公主！

## 注意事项

1. 小游戏不支持 DOM 操作，所有 UI 都需要用 Canvas 绘制
2. 音频 API 与小程序略有不同，使用 `wx.createWebAudioContext()` 播放音效
3. 触摸事件需要使用 `wx.onTouchStart` 等全局 API
