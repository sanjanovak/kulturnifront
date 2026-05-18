export interface NetworkData {
  Label: string;
  Category: string;
  Degree: number;
  WeightedDegree: number;
  Closeness: number;
  Betweenness: number;
  Eigenvector: number;
  LouvainCommunity?: string;
}

export interface EdgeData {
  Source: string;
  Target: string;
  Weight?: number;
}

const fetchSheetValues = async (accessToken: string, spreadsheetId: string, range: string) => {
  const valuesResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!valuesResponse.ok) {
    const errorBody = await valuesResponse.text().catch(() => 'No error body');
    throw new Error(`Failed to fetch values for range ${range}: ${errorBody}`);
  }

  return await valuesResponse.json();
};

export const fetchSpreadsheetData = async (accessToken: string, spreadsheetId: string): Promise<{ nodes: NetworkData[], edges: EdgeData[] }> => {
  const spreadsheetResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!spreadsheetResponse.ok) {
    const errorBody = await spreadsheetResponse.text().catch(() => 'No error body');
    throw new Error(`Failed to fetch spreadsheet metadata: ${errorBody}`);
  }

  const spreadsheet = await spreadsheetResponse.json();
  
  // Find "Nodes" and "Edges" sheets
  const nodeGid = '875430312';
  const nodeSheet = spreadsheet.sheets.find((s: any) => s.properties.sheetId.toString() === nodeGid) || spreadsheet.sheets[0];
  const edgeSheet = spreadsheet.sheets.find((s: any) => 
    s.properties.title.toLowerCase().includes('edge') || 
    s.properties.title.toLowerCase().includes('veze') ||
    s.properties.title.toLowerCase().includes('rubovi')
  );

  // Fetch Nodes
  const nodeData = await fetchSheetValues(accessToken, spreadsheetId, `${nodeSheet.properties.title}!A1:Z5000`);
  const nodeRows = nodeData.values || [];
  
  if (nodeRows.length === 0) return { nodes: [], edges: [] };

  const nodeHeaders = nodeRows[0].map((h: string) => h.trim());
  const findNodeIdx = (terms: string[]) => nodeHeaders.findIndex((h: string) => terms.some(t => h.toLowerCase().includes(t.toLowerCase())));

  const labelIdx = findNodeIdx(['Label', 'Name', 'Čvor', 'Id']);
  const categoryIdx = findNodeIdx(['Category', 'Kategorija', 'Kluster']);
  const degreeIdx = findNodeIdx(['Degree', 'Stupanj']);
  const wDegreeIdx = findNodeIdx(['Weighted Degree', 'Težinski stupanj']);
  const closenessIdx = findNodeIdx(['Closeness', 'Bliskost']);
  const betweennessIdx = findNodeIdx(['Betweenness', 'Između']);
  const eigenvectorIdx = findNodeIdx(['Eigenvector', 'Svojstvena']);

  const nodes: NetworkData[] = nodeRows.slice(1).map((row: any[]) => ({
    Label: row[labelIdx] || 'Unknown',
    Category: row[categoryIdx] || 'Uncategorized',
    Degree: parseFloat(row[degreeIdx]) || 0,
    WeightedDegree: parseFloat(row[wDegreeIdx]) || 0,
    Closeness: parseFloat(row[closenessIdx]) || 0,
    Betweenness: parseFloat(row[betweennessIdx]) || 0,
    Eigenvector: parseFloat(row[eigenvectorIdx]) || 0,
  }));

  // Fetch Edges if found
  let edges: EdgeData[] = [];
  if (edgeSheet) {
    try {
      const edgeDataJson = await fetchSheetValues(accessToken, spreadsheetId, `${edgeSheet.properties.title}!A1:Z10000`);
      const edgeRows = edgeDataJson.values || [];
      if (edgeRows.length > 1) {
        const edgeHeaders = edgeRows[0].map((h: string) => h.trim());
        const findEdgeIdx = (terms: string[]) => edgeHeaders.findIndex((h: string) => terms.some(t => h.toLowerCase().includes(t.toLowerCase())));
        
        const sourceIdx = findEdgeIdx(['Source', 'Izvor', 'Od']);
        const targetIdx = findEdgeIdx(['Target', 'Cilj', 'Do']);
        const weightIdx = findEdgeIdx(['Weight', 'Težina']);

        edges = edgeRows.slice(1).map((row: any[]) => ({
          Source: row[sourceIdx],
          Target: row[targetIdx],
          Weight: parseFloat(row[weightIdx]) || 1,
        })).filter(e => e.Source && e.Target);
      }
    } catch (e) {
      console.warn('Failed to fetch edges:', e);
    }
  }

  return { nodes, edges };
};
