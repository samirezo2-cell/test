
export interface Stakeholder {
  role: string;
  name: string;
  status: string;
  details?: string;
  faxTel?: string;
  email?: string;
  nAoo?: string;
  nMarche?: string;
  documents?: string;
  visitePrevue?: string;
  dateOuverturePlis?: string;
  visa?: string;   // Pour le BCT
  notice?: string; // Pour le BET
}

export interface TechnicalStudy {
  label: string;
  progress: number;
  isPaid: boolean;
  attributaire?: string;
}

export interface PhaseStatus {
  label: string;
  value: string;
}

export interface ProjectStyle {
  borderRadius?: number;
  fontSizeScale?: number;
}

export interface ProjectData {
  id: string;
  rowIndex?: number;
  name: string;
  convention: string;
  entreprise?: string;
  progressEtude: number;
  progressCPS: number;
  progressValidation: number;
  stakeholders: Stakeholder[];
  phases: PhaseStatus[];
  topographicStudy: TechnicalStudy;
  geotechnicalStudy: TechnicalStudy;
  lastUpdated: string;
  customStyle?: ProjectStyle;
  
  // Enterprise & Project Detail Fields
  startDate?: string; 
  duration?: string;  
  endDate?: string;   
  financialEstimation?: string; 
  description?: string; 
  projectManager?: string; 
  technicalRemarks?: string; 
  projectNAoo?: string; 
  projectNMarche?: string; 
  entrepriseTel?: string; 
  entrepriseEmail?: string;

  // Specific Enterprise Request Fields
  entrepriseVisite?: string;
  entrepriseOuverturePlis?: string;
  entrepriseNAoo?: string;
  entrepriseNMarche?: string;
  travauxLances?: string;
  progressTravaux?: number;
  delaiPrevisionnel?: string;
  autorisation?: string;
  paiement?: string;
  dce?: string;
  bet_name?: string;
  bct_name?: string;
  arch_name?: string;
  maps?: string;
  totalDecomptes?: number;
}

export type ExtractionStatus = 'idle' | 'processing' | 'success' | 'error';
