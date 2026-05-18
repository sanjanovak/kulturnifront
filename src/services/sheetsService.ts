export interface NetworkData {
  Label: string;
  Category: string;
  Degree: number;
  WeightedDegree: number;
  Closeness: number;
  Betweenness: number;
  Eigenvector: number;
}

export const fetchSpreadsheetData = async (accessToken: string, spreadsheetId: string): Promise<NetworkData[]> => {
  // First, get the sheet name for the gid 875430312 if possible, or just fetch the first sheet
  const spreadsheetResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!spreadsheetResponse.ok) {
    throw new Error('Failed to fetch spreadsheet metadata');
  }

  const spreadsheet = await spreadsheetResponse.json();
  // Find the sheet title by gid
  const gid = '875430312';
  const sheet = spreadsheet.sheets.find((s: any) => s.properties.sheetId.toString() === gid) || spreadsheet.sheets[0];
  const sheetTitle = sheet.properties.title;

  const range = `${sheetTitle}!A1:Z5000`; // Fetch a large enough range
  const valuesResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!valuesResponse.ok) {
    throw new Error('Failed to fetch spreadsheet values');
  }

  const data = await valuesResponse.json();
  const rows = data.values;

  if (!rows || rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((h: string) => h.trim());
  
  // Find indices for relevant columns (using case-insensitive matching)
  const findIndex = (searchTerms: string[]) => 
    headers.findIndex((h: string) => searchTerms.some(term => h.toLowerCase().includes(term.toLowerCase())));

  const labelIdx = findIndex(['Label', 'Name', 'Čvor']);
  const categoryIdx = findIndex(['Category', 'Kategorija', 'Kluster']);
  const degreeIdx = findIndex(['Degree', 'Stupanj']);
  const wDegreeIdx = findIndex(['Weighted Degree', 'Težinski stupanj']);
  const closenessIdx = findIndex(['Closeness', 'Bliskost']);
  const betweennessIdx = findIndex(['Betweenness', 'Između']);
  const eigenvectorIdx = findIndex(['Eigenvector', 'Svojstvena']);

  return rows.slice(1).map((row: any[]) => ({
    Label: row[labelIdx] || 'Unknown',
    Category: row[categoryIdx] || 'Uncategorized',
    Degree: parseFloat(row[degreeIdx]) || 0,
    WeightedDegree: parseFloat(row[wDegreeIdx]) || 0,
    Closeness: parseFloat(row[closenessIdx]) || 0,
    Betweenness: parseFloat(row[betweennessIdx]) || 0,
    Eigenvector: parseFloat(row[eigenvectorIdx]) || 0,
  }));
};
