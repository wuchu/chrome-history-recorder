## ADDED Requirements

### Requirement: 基于内容的哈希命名
系统必须 (SHALL) 使用基于内容的哈希为图片文件命名。

#### Scenario: 从图片内容生成文件名
- **WHEN** 图片被保存
- **THEN** 系统必须 (SHALL) 计算图片二进制内容的 SHA-256 哈希

#### Scenario: 使用截断哈希作为文件名
- **WHEN** 哈希被计算
- **THEN** 系统必须 (SHALL) 使用前 16 个字符作为基础文件名

#### Scenario: 保留文件扩展名
- **WHEN** 图片被保存
- **THEN** 系统必须 (SHALL) 附加原始文件扩展名（例如 `.jpg`、`.png`）

### Requirement: 重复预防
系统必须 (SHALL) 根据内容哈希防止存储重复图片。

#### Scenario: 检测重复内容
- **WHEN** 具有相同内容的图片已存在
- **THEN** 系统必须 (SHALL) 不创建新文件

#### Scenario: 为重复内容返回现有哈希
- **WHEN** 提交重复图片
- **THEN** 系统必须 (SHALL) 返回现有内容哈希，不报错

### Requirement: 哈希验证
系统必须 (SHALL) 支持内容哈希完整性验证。

#### Scenario: 验证保存的图片哈希
- **WHEN** 图片被检索
- **THEN** 系统必须 (SHALL) 能够重新计算并验证哈希与文件名匹配