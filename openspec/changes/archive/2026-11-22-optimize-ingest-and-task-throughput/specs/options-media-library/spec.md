## MODIFIED Requirements

### Requirement: Stable live list updates

The Media Library SHALL merge live capture events without duplicating items, drifting the total, or degrading as the session grows.

#### Scenario: New live item
- **WHEN** no search or filters are active and a `file:captured` event arrives
- **THEN** the Media Library SHALL insert the item once at the top of the grid
- **AND** the header total SHALL increase by one if the item was not already loaded

#### Scenario: Filters are active
- **WHEN** a search or filter is active and a capture or classification event arrives
- **THEN** the Media Library SHALL debounce a query refresh instead of inserting an unfiltered live item

#### Scenario: Duplicate append
- **WHEN** a page or event returns a hash that is already in the list
- **THEN** the Media Library SHALL keep one item for that hash
- **AND** it SHALL NOT create a duplicate grid entry

#### Scenario: Bounded event history
- **WHEN** capture runs for a long time
- **THEN** the retained Background event log SHALL be capped
- **AND** live item/status state SHALL be derived incrementally rather than by rescanning all retained events

#### Scenario: Tag refresh uses the event payload
- **WHEN** the latest Background event is `tags:updated`
- **THEN** the Media Library SHALL update its tag vocabulary and tag counts from the event's `{ tags, counts }` payload
- **AND** it SHALL NOT issue another `getTagCounts` or `listTags` request for that event
- **AND** unrelated events SHALL NOT trigger tag refreshes

#### Scenario: Tag refresh falls back for payload-less events
- **WHEN** a tag-related event arrives without a usable payload
- **THEN** the Media Library MAY refresh tag counts and vocabulary once, debounced

#### Scenario: Coalesced snapshots update once
- **WHEN** several `tags:updated` events arrive in a burst
- **THEN** the Media Library SHALL apply the latest snapshot once
- **AND** it SHALL NOT queue one network request per event

#### Scenario: Trash page does not retain the full event log
- **WHEN** the Trash page observes Background events
- **THEN** it SHALL handle only the events it needs through a listener
- **AND** it SHALL NOT accumulate the full bounded event history
