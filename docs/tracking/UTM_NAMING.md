# Project Beej UTM naming

Use lowercase ASCII values and one source of truth for every campaign. Never put personal information or order/customer identifiers into a UTM parameter.

| Field | Use | Example |
| --- | --- | --- |
| `utm_source` | Publisher/platform | `instagram`, `google`, `creator_riya` |
| `utm_medium` | Channel type | `paid_social`, `cpc`, `email`, `influencer`, `organic_social` |
| `utm_campaign` | Stable campaign name | `diwali_2026_launch` |
| `utm_id` | Internal campaign key | `pb_2026_014` |
| `utm_content` | Creative/placement | `reel_makhana_crunch_v1` |
| `utm_term` | Paid keyword/audience label | `healthy_snacks_india` |

Example:

```text
https://YOUR_FINAL_DOMAIN/shop?utm_source=instagram&utm_medium=paid_social&utm_campaign=diwali_2026_launch&utm_id=pb_2026_014&utm_content=reel_makhana_crunch_v1
```

Rules:

- Use underscores, not spaces; do not change capitalization or spelling halfway through a campaign.
- Name the human partner/publisher in `utm_source`; use `influencer` as the `utm_medium`.
- Use `utm_content` to distinguish creative variations and placements, not audiences containing personal details.
- Leave unrelated parameters, checkout tokens, private cart IDs and customer identifiers out of campaign URLs.
- Direct visits and same-site links do not replace the stored campaign. A later non-direct campaign becomes latest touch; first touch remains available for up to 30 days after consent.
- Validate links before sending, remove test parameters, and use platform link builders that preserve the final canonical HTTPS domain.
