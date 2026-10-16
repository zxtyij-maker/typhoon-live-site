# 观风：真实数据与 GitHub Pages 发布

## 仓库与网站

- 网站代码：`https://github.com/zxtyij-maker/typhoon-live-site`。
- Pages 地址：`https://zxtyij-maker.github.io/typhoon-live-site/`。
- 原有 `typhoon-live` 计划书仓库继续保持私有。公共仓库不含原计划书、旧提交历史、本地截图、日志、凭据或演示数据。
- 公共提交采用 GitHub noreply 邮箱，发布产物只包含网页、样式、脚本与真实数据快照。

## 数据来源与字段

数据来源为[浙江省台风路径实时发布系统](https://typhoon.slt.zj.gov.cn/)，主办单位为浙江省水利厅。通过公开 HTTPS 页面数据入口读取：

- `GET https://typhoon.slt.zj.gov.cn/Api/TyphoonList/{year}`：年度列表，`isactive` 表示来源列出的活跃状态。
- `GET https://typhoon.slt.zj.gov.cn/Api/TyphoonInfo/{tfid}`：指定台风实况与机构预报。

这些是网站公开使用的数据入口，不是已取得服务等级承诺的商业 API。页面标明来源和时间，不宣称本站为官方服务。2026-10-17（北京时间）已通过 GitHub 托管运行器实测 HTTPS 响应。

原字段 `lng/lat` 对应经纬度；`power` 为风力级数，`speed` 为 m/s，`movespeed` 为 km/h，`pressure` 为 hPa。无时区的来源时间按北京时间解析，统一存为 ISO 8601 UTC，再以北京时间展示。空白字段保持 `null`，不填零。

`points` 为历史观测记录；最新观测点的 `forecast` 按 `tm` 分组，其 `forecastpoints` 保存预报点，`ybsj` 作为预报发布时间，`time` 为预报有效时间。仅保留晚于最新实况的预报点。默认选择来源标记“中国”，其他机构可以单独切换；不混合不同机构的风速统计口径。

`warnlevel` 未提供足以用于本地预警的适用区域与完整发布信息，**不映射为居民地区预警**。真实页面明确显示“地区预警暂未接入”，链接气象台查询入口。不会把未接入、抓取失败或无活跃台风解释为安全。

## 自动更新

`.github/workflows/update-and-deploy.yml` 在推送主分支、手动运行及计划任务时执行。计划为 UTC 每小时第 7、22、37、52 分钟，即每 15 分钟一次；北京时间同样为每小时这四个分钟。选择非整点以避开部分高峰。

GitHub Actions 调度可能延迟或漏排，不是精确的 15 分钟时钟。公共仓库长期无活动时，平台可能停用计划工作流；维护者应查看 Actions 状态并按需要重新启用。上游气象观测的发布频率也不等于抓取频率。

执行顺序：校验真实数据样本 → 尝试读取上次已发布快照 → 从官方接口抓取 → 校验并规范化 → 构建 `dist` 白名单 → 发布 Pages → 输出摘要。运行失败会在 Actions 标红；数据源失败时仍发布明确的不可用/旧记录状态，不会伪造成功。

数据直接进入部署产物，每 15 分钟不产生一次 Git 提交。所需权限仅为 `contents: read`、`pages: write` 与 Pages OIDC 的 `id-token: write`，没有用户密钥或付费服务。

## 故障与时间提示

- 每个接口最多 3 次、每次 25 秒超时，重试带退避；逐个抓取活跃台风，避免高并发。
- 抓取、字段校验或日期校验失败时，保留最近成功快照并显示失败状态；初次即失败时显示数据不可用。
- 成功返回空活跃列表与抓取失败分别处理，不以历史台风假充当前台风。
- 抓取超过 45 分钟提示延迟，观测超过 6 小时提示核对来源。这是本站时效提示阈值，不是官方业务发布标准。
- 网页每分钟检查一次已发布快照；“检查更新”只读取本站快照，不直接抓取浙江源站。

## 本地命令

```text
node --test tests/normalize.test.mjs
node scripts/fetch-data.mjs
node scripts/build-site.mjs
node preview.mjs
```

预览地址为 `http://127.0.0.1:8877`。本机网络若不能连接源站，可从已部署网站下载 `data/live.json` 与 `data/live.js` 供本地检查；不得使用演示数据作为生产回退。

路径图按真实经纬度绘制坐标图，不提供地理底图、风圈概率或风险范围；完整官方地图由页面链接进入。原 HTML 演示保存在本地 `demo/`，不会进入上线产物。
