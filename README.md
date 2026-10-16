# 观风 WINDWATCH

面向沿海居民的独立台风信息网页，展示浙江省台风路径实时发布系统公开的实况、历史路径与机构预报。

- 网站：[观风台风信息](https://zxtyij-maker.github.io/typhoon-live-site/)
- 原始来源：[浙江省台风路径实时发布系统](https://typhoon.slt.zj.gov.cn/)
- 自动更新：[GitHub Actions](https://github.com/zxtyij-maker/typhoon-live-site/actions)

## 功能

台风名称、中心位置、移动趋势、最大风力及风速；可交互经纬度路径图、路径文字表格、多机构预报切换；观测、预报发布时间和抓取时间分别展示。

Actions 每 15 分钟计划抓取一次并发布 Pages；平台调度可能延迟，页面以实际更新时间为准。源站失败时显示旧记录或不可用，不回退到演示数据。

地区预警暂未接入，页面提供官方查询入口。不会把台风中心风力或数据接口的标志字段直接转成当地预警。本站非官方发布系统，请以当地气象台和政府最新通知为准。

## 运行

无需安装第三方依赖，使用 Node.js 22 或更高版本。

```text
node --test tests/normalize.test.mjs
node scripts/fetch-data.mjs
node scripts/build-site.mjs
node preview.mjs
```

本地预览：`http://127.0.0.1:8877`。详细数据映射、故障行为和维护方法见 [DEPLOYMENT.md](DEPLOYMENT.md)。

数据保留来源与原单位。公开入口可用性不代表服务等级、无限调用额度或再分发许可承诺；维护者需持续留意来源的使用要求与接口变化。
