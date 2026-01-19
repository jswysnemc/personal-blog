---
title: "实战记录：使用 acme.sh 申请泛域名证书与 Nginx 配置全流程（含踩坑指南）"
description: "在部署 HTTPS 时，如果需要同时支持主域名和所有二级域名，申请泛域名证书是最佳选择。本文记录了使用 acme.sh 配合 Cloudflare DNS API 申请泛域名证书的完整流程。"
pubDate: 2026-01-19
category: tech
tags: ["HTTPS", "SSL", "Nginx", "acme.sh", "Cloudflare"]
draft: false
---

# 实战记录：使用 acme.sh 申请泛域名证书与 Nginx 配置全流程（含踩坑指南）

在部署 HTTPS 时，如果需要同时支持主域名（如 `snemc.cn`）和所有二级域名（如 `*.snemc.cn`），申请\*\*泛域名证书（Wildcard Certificate）\*\*是最佳选择。

本文记录了在 Linux 服务器上使用 `acme.sh` 配合 Cloudflare DNS API 申请泛域名证书，并配置 Nginx 的完整过程，特别整理了权限、环境变量及 DNS 解析等常见问题的解决方案。

## 一、 环境准备

1.  **系统**：Linux (CentOS/Ubuntu/Debian)
    
2.  **Web服务器**：Nginx
    
3.  **工具**：`acme.sh` (开源的证书自动化签发工具)
    
4.  **DNS服务商**：Cloudflare (或其他支持 API 的服务商，如阿里云、腾讯云)
    

## 二、 安装 acme.sh

```bash
# 1. 安装脚本 (替换你的邮箱)
curl https://get.acme.sh | sh -s email=my@example.com

# 2. 使命令生效
source ~/.bashrc
```

## 三、 配置 DNS API (以 Cloudflare 为例)

泛域名证书必须使用 **DNS-01 验证**。我们需要提供 API Key 让 `acme.sh` 自动添加 TXT 记录。

为了安全，推荐使用 **API Token** 而不是全局 Key。

1.  登录 Cloudflare -> My Profile -> API Tokens -> Create Token。
    
2.  使用 **Edit zone DNS** 模板。
    
3.  获取 **Account ID** (在域名概览页右下角)。
    

在服务器终端执行（仅需执行一次，会自动保存）：

```bash
export CF_Token="你的_Cloudflare_Token_xxxxxxxx"
export CF_Account_ID="你的_Account_ID_xxxxxxxx"
```

## 四、 申请泛域名证书

执行以下命令，同时申请根域名和泛域名：

```bash
acme.sh --issue --dns dns_cf -d snemc.cn -d "*.snemc.cn"
```

*如果你使用的是阿里云，参数改为* `--dns dns_ali`*；腾讯云为* `--dns dns_dp`*。*

成功后会显示 `Cert success`。

## 五、 安装证书到 Nginx (Deploy)

**注意**：不要直接链接 `~/.acme.sh/` 下的文件。应使用 `--install-cert` 命令将证书复制到指定目录，并指定重载 Nginx 的命令。

```bash
# 1. 创建目录并修改权限（解决普通用户无法写入的问题）
sudo mkdir -p /etc/nginx/ssl
sudo chown -R $(whoami) /etc/nginx/ssl

# 2. 安装证书
acme.sh --install-cert -d snemc.cn \
--key-file       /etc/nginx/ssl/snemc.cn.key \
--fullchain-file /etc/nginx/ssl/fullchain.cer \
--reloadcmd     "sudo /usr/sbin/nginx -s reload"
```

## 六、 配置 Nginx

编辑 Nginx 配置文件（例如 `/etc/nginx/conf.d/snemc.cn.conf`）：

```nginx
server {
    listen 443 ssl;
    server_name snemc.cn *.snemc.cn;

    # 证书路径必须绝对匹配
    ssl_certificate     /etc/nginx/ssl/fullchain.cer;
    ssl_certificate_key /etc/nginx/ssl/snemc.cn.key;

    # 其他 SSL 优化配置...
    location / {
        root   /usr/share/nginx/html;
        index  index.html index.htm;
    }
}
```

## 七、 踩坑与故障排查 (Troubleshooting)

在配置过程中，我们遇到了以下几个典型报错，以下是解决方法：

### 1\. 自动续期报错：`sudo: sorry, you are not allowed to set... TERMINFO`

**现象**：手动或自动执行重载命令时，提示无法设置 `TERMINFO` 环境变量。 **原因**：SSH 客户端发送了环境变量，但 sudo 安全策略默认禁止继承。 **解决方法**：修改 sudo 配置文件。

```bash
sudo visudo
# 在文件头部 Defaults 区域添加：
Defaults env_keep += "TERMINFO"
```

### 2\. Nginx 警告：`conflicting server name`

**现象**：`nginx -t` 或 reload 时提示 `conflicting server name "snemc.cn" on 0.0.0.0:443, ignored`。 **原因**：多个配置文件中定义了相同的域名（通常是默认的 `default.conf` 和你新建的配置冲突）。 **解决方法**：

1.  查找冲突文件：`sudo grep -r "snemc.cn" /etc/nginx/`
    
2.  删除或重命名多余的配置文件（如 `default.conf`）。
    

### 3\. OpenSSL 测试报错：`No address associated with hostname`

**现象**：在服务器验证证书时提示无法解析域名。 **原因**：DNS A 记录尚未设置或未生效。 **解决方法**： 在 DNS 解析生效前，强制 OpenSSL 连接本地验证：

```bash
echo | openssl s_client -connect 127.0.0.1:443 -servername snemc.cn 2>/dev/null | openssl x509 -noout -dates
```

如果看到 `notAfter` 是未来的日期，说明证书配置已成功。

## 八、 最后一步：配置 DNS 解析 (A 记录)

证书申请时的 TXT 记录只是为了验证。要让网站真正能访问，必须去域名解析商（阿里云/万网/Cloudflare）添加 **A 记录**。

| 记录类型 | 主机记录 | 记录值 | 说明  |
| --- | --- | --- | --- |
| **A** | `@` | 服务器公网IP | 解析 snemc.cn |
| **A** | `*` | 服务器公网IP | 解析 \*.snemc.cn (泛解析) |

配置完成后，等待几分钟，在本地终端 `ping snemc.cn`，如果显示服务器 IP，即可通过浏览器愉快地访问 HTTPS 站点了。<br>



![Lofi - Anime Girl2](https://imgbed.snemc.cn/i/27ca8130c1ee.png)