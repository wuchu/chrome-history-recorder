## MODIFIED Requirements

### Requirement: 响应式列数

The system SHALL compute Masonry column count from the live container width via `ResizeObserver`, allowing the column count to scale continuously with the container's available space. The minimum column count SHALL be 1; there SHALL be no upper bound. Column width and gap SHALL remain configurable inputs to the calculation.

#### Scenario: 容器极窄时退化为单列
- **WHEN** the observed container width is smaller than `columnWidth + gap`
- **THEN** the hook MUST return a `columnCount` of 1
- **AND** the grid MUST render media as a single column without overlap

#### Scenario: 容器宽度连续增长，列数同步增加
- **WHEN** the container width grows past additional `columnWidth + gap` increments
- **THEN** the hook MUST recompute `columnCount = Math.floor((width + gap) / (columnWidth + gap))`
- **AND** there MUST NOT be any hard-coded ceiling that caps the result

#### Scenario: 列宽与列间距由调用方覆盖
- **WHEN** the consumer of `useColumnCount` passes custom `columnWidth` or `gap`
- **THEN** the hook MUST use those values in the column-count formula
- **AND** the resulting `columnCount` MUST satisfy `columnCount * columnWidth + (columnCount - 1) * gap <= width` whenever `columnCount >= 1`

#### Scenario: 容器宽度变化时实时更新
- **WHEN** the observed container element resizes (e.g., DevTools panel docking changes)
- **THEN** `ResizeObserver` MUST trigger a recompute and emit the new `columnCount` and `containerWidth`
