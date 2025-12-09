/**
 * 环境配置模板
 * 使用方法：复制此文件并重命名为 env.js，然后填入你的配置
 */
const ENV = {
  // CDN 基础地址（替换为你的 CDN 域名）
  CDN_BASE: 'https://your-bucket.file.myqcloud.com',
  // COS 基础地址（替换为你的 COS 域名）
  COS_BASE: 'https://your-bucket.cos.myqcloud.com',
  // 本地资源路径（作为降级方案）
  LOCAL_BASE: '',
};

export default ENV;
