# CardioVision AI — presentation outline

## Slide 1: Problem statement
- Cardiovascular disease remains a major public health challenge.
- Need for a transparent, educational, visual explanation tool.

## Slide 2: Dataset and methodology
- Real retrospective clinical dataset with 303 records and 59 columns.
- Target outcomes: Cath, LAD, LCX, and RCA.
- Pipeline includes preprocessing, imputation, and one-hot encoding.

## Slide 3: Model approach
- Separate models for CAD, LAD, LCX, and RCA.
- Excluded all outcome columns to avoid target leakage.
- Train/test split with stratification.

## Slide 4: Metrics and evaluation
- Accuracy, precision, recall, F1-score, confusion matrix, ROC-AUC.
- Explain that scores are exploratory and not validated for clinical usage.

## Slide 5: Visualization and explainability
- 3D interactive heart viewer.
- Honest fallback for vessel results because the current GLB asset lacks separate LAD/LCX/RCA meshes.
- Permutation importance shown as model-derived importance only.

## Slide 6: Limitations and future work
- Small dataset and no clinical validation.
- Need for richer anatomical model and expert review.
- Future integration with better vessel-specific 3D modeling and additional patient data.

## Optional closing slide
- Educational prototype for research and hackathon demonstration.
- Not intended for diagnosis or treatment decisions.
