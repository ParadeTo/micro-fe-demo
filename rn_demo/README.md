# RN Demo

一个最小 Expo React Native demo，会请求旁边 `server/` 项目的后端接口并展示数据。

## 目录

```text
rn_demo/
  App.js          RN 页面
  src/api.js      请求后端接口的 API client
  test/api.test.js
  app.json
  package.json

../server/
  src/app.js      后端接口
  src/index.js    后端启动入口
```

## 先启动后端

```bash
cd ../server
npm install
npm run dev
```

默认接口地址：

```text
http://localhost:3001
```

可用接口：

```text
GET /api/health
GET /api/profile
GET /api/tasks
```

## 启动 RN

```bash
cd ../rn_demo
npm install
npm start
```

iOS 模拟器：

```bash
npm run ios
```

Android 模拟器：

```bash
npm run android
```

## API 地址说明

默认配置：

- iOS 模拟器：`http://localhost:3001`
- Android 模拟器：`http://10.0.2.2:3001`

如果用真机运行，需要把地址换成电脑局域网 IP：

```bash
EXPO_PUBLIC_API_BASE_URL=http://你的电脑IP:3001 npm start
```

## 测试

```bash
npm test
```
