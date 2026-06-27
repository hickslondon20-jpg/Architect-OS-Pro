# M&R Audit: Scoring Logic & Formulas

## Core Concept: Maturity vs. Readiness

There are two distinct high-level scores that drive the narrative. They are **not** the same and are calculated differently.

### 1. Maturity Score ("Where you stand")
*   **Definition**: A descriptive score of current foundational strength.
*   **Question**: "How mature is the business today?"
*   **Concept**: Current state quality, capability, and consistency.
*   **Narrative Role**: Reassurance. "You have a strong foundation."

### 2. Readiness Score ("How prepared you are to act")
*   **Definition**: A diagnostic score of alignment and activation potential.
*   **Question**: "How ready is the business to address what matters most at this horizon?"
*   **Concept**: Activation, friction load, and strategic alignment.
*   **Narrative Role**: Constructive Tension. "Here is what is holding you back."

---

## Formulas

### 1. Maturity Score Formula
A straightforward performance percentage.

```math
Maturity % = Total Weighted Checkpoint Score / Total Max Weighted Checkpoint Score
```

*   **Inputs**:
    *   Checkpoint Response (Yes/Somewhat/No) mapped to points.
    *   Urgency Weights (Stage-specific).
*   **Normalization**: Fully normalized by the max possible score for that stage.

### 2. Readiness Score Formula
A gap-based index penalized by strategic importance.

```math
Readiness % = 1 - Weighted Gap Index
```

#### Step A: Determine Weights per Capability `i`
For each capability, calculate a specific "Readiness Weight":

```math
weight_i = norm_urgency_i × 3P_weight_i × stage_fit_factor_i
```

*   **`norm_urgency_i`**: Normalized 0-1 urgency (from assessment config).
*   **`3P_weight_i`**: Priority Alignment.
    *   `Prioritize` = **1.0** (High impact)
    *   `Plant` = **0.6**
    *   `Progressively Iterate` = **0.3**
*   **`stage_fit_factor_i`**: Stage Variance.
    *   `Below Stage` = **1.2** (Gap hurts more)
    *   `At Stage` = **1.0**
    *   `Ahead of Stage` = **0.9** (Gap hurts less)

#### Step B: Calculate Weighted Gap Index
Aggregated across all 25 capabilities.

```math
Weighted Gap Index = Σ( cap_gap_i × weight_i ) / Σ( weight_i )
```

*   `cap_gap_i` = `1 - cap_score_pct_i` (Percent deficit in that capability).

#### Step C: Final Score
```math
Overall Readiness % = 1 - Weighted Gap Index
```

---

## Interpretation Bands

### Maturity Bands
*   Uses standard stage-progression bands (e.g., Striving Early, Striving Late).

### Readiness Bands
| Band | Label | Range |
| :--- | :--- | :--- |
| **4** | **High Readiness** | **85 – 100%** |
| **3** | **Solid Readiness** | **70 – 84%** |
| **2** | **Cautious Readiness** | **40 – 69%** |
| **1** | **Fragile Readiness** | **0 – 39%** |

---

## Visualizing validity
*   **High Maturity / Low Readiness**: "Strong systems, but major gaps in the few things that matter most right now." (Common in Transition)
*   **Low Maturity / High Readiness**: "Scrappy and undeveloped, but perfectly aligned with current priorities." (Common in early stages)
