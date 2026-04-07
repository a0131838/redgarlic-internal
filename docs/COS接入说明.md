# 腾讯云 COS 接入说明

红蒜系统已经支持通过 S3 兼容接口接入腾讯云 COS。

## 需要准备的值
- Bucket 名称
- Bucket 所在 Region
- S3 兼容 Endpoint
- SecretId
- SecretKey

## 环境变量映射

```env
SHARED_FILE_STORAGE_DRIVER=s3
SHARED_FILE_S3_BUCKET=
SHARED_FILE_S3_REGION=
SHARED_FILE_S3_ENDPOINT=
SHARED_FILE_S3_FORCE_PATH_STYLE=false
SHARED_FILE_S3_ACCESS_KEY_ID=
SHARED_FILE_S3_SECRET_ACCESS_KEY=
```

## 腾讯云中通常对应关系
- Bucket: COS 存储桶完整名称，例如 `redgarlic-files-1250000000`
- Region: 例如 `ap-singapore`
- Endpoint: 例如 `https://cos.ap-singapore.myqcloud.com`
- Access Key Id: 腾讯云 API 密钥中的 `SecretId`
- Secret Access Key: 腾讯云 API 密钥中的 `SecretKey`

## 当前实现方式
- 上传时根据 `SHARED_FILE_STORAGE_DRIVER` 自动选择 `local` 或 `s3`
- 文件记录保存在数据库的 `SharedFile.filePath`
- 本地文件保存为 `local://...`
- COS 文件保存为 `s3://bucket/key`
- 下载和预览统一走系统内部受控路由

## 切换建议
1. 先保留 `local` 跑通功能
2. 配置好 COS 后，把 `SHARED_FILE_STORAGE_DRIVER` 改成 `s3`
3. 上传一份测试文件，确认预览和下载正常
4. 后续如需迁移旧文件，再补一个批量迁移脚本
