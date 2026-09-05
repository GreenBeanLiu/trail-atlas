# trail-atlas

徒步轨迹记录与查看。Expo Router（文件式路由），地图用 MapLibre。

## 跑起来

```bash
npm install
npm start
npm run ios
npm run android
```

## 结构

用的是 **Expo Router**，不是 React Navigation 手工配路由：

```
app/_layout.tsx        根布局
app/(tabs)/index.tsx   首页
app/(tabs)/record.tsx  录制轨迹
app/(tabs)/import.tsx  导入
app/track/[id].tsx     轨迹详情（动态路由）
```

加页面 = 在 `app/` 下加文件，不用改路由表。

## 地图

`@maplibre/maplibre-react-native` —— 开源栈，不是 Mapbox。样式和 tile 源要自己配，
换地图源时注意它和 Mapbox SDK 的 API 不完全一致。

## 相关

`trailai-mobile`（截图转路书）和 `trail-planner`（路线规划）是同一条线上的
其他尝试，三者互相独立。
