
import pandas as pd
from pathlib import Path

data_folder = Path(__file__).parent / "data"
excel_files = list(data_folder.glob("*.xlsx"))

if not excel_files:
    print("ERROR: No Excel file found inside the data folder.")
else:
    file_path = excel_files[0]
    print("Dataset found:", file_path.name)

    df = pd.read_excel(file_path)

    print("\nDataset shape (rows, columns):")
    print(df.shape)

    print("\nColumn names:")
    print(df.columns.tolist())

    print("\nFirst 5 rows:")
    print(df.head())

    print("\nMissing values per column:")
    print(df.isnull().sum())
