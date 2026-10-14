
import pandas as pd
from pathlib import Path

data_folder = Path(__file__).parent / "data"
excel_file = list(data_folder.glob("*.xlsx"))[0]

df = pd.read_excel(excel_file)

print("Dataset shape:", df.shape)

print("\nMissing values:")
print(df.isnull().sum().sort_values(ascending=False).head(15))

print("\nTarget column distributions:")
for col in ["Cath", "LAD", "LCX", "RCA"]:
    print(f"\n{col}:")
    print(df[col].value_counts(dropna=False))

print("\nDuplicate rows:", df.duplicated().sum())
print("\nData types:")
print(df.dtypes)
