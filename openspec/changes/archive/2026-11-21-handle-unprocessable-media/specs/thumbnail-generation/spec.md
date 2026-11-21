## ADDED Requirements

### Requirement: 解码能力查询

缩略图子系统必须 (SHALL) 提供其捆绑解码器当前实际可读取的图片 MIME 类型集合，供 AI 媒体资格判定使用。

#### Scenario: 查询可解码的图片 MIME 类型
- **WHEN** 其他子系统查询图片解码能力
- **THEN** 系统必须 (SHALL) 返回当前捆绑的 sharp/libvips 构建支持输入解码的图片 MIME 类型
- **AND** 集合必须 (SHALL) 由实际解码器能力推导，而不是硬编码常量
- **AND** 当前构建无法解码的格式（例如 ICO、BMP）必须 (SHALL) 不出现在集合中

#### Scenario: 格式能力与 MIME 类型映射
- **WHEN** 子系统请求解码能力
- **THEN** 系统必须 (SHALL) 将解码器格式标识映射为对应 MIME 类型
- **AND** 无法映射为图片 MIME 类型的格式必须 (SHALL) 被排除

#### Scenario: 解码能力用于资格预检
- **WHEN** AI 子系统判定某个图片能否通过缩略图获得代表性图像
- **THEN** 它必须 (SHALL) 使用该解码能力集合
- **AND** 不在集合中的格式必须 (SHALL) 被判定为不可处理，而不是在调用时反复失败
