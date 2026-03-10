
import { GoogleGenAI, Type } from "@google/genai";
import { ProjectData } from "../types";

const SHARED_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Nom du centre" },
    convention: { type: Type.STRING, description: "NARSA, DGPC, etc." },
    entreprise: { type: Type.STRING, description: "Nom de l'entreprise (ENTREPRISE Attributaire)" },
    progressEtude: { type: Type.INTEGER, description: "Avancement PHASE ETUDE (0-100)" },
    progressCPS: { type: Type.INTEGER, description: "Avancement REALISE CPS (0-100)" },
    progressValidation: { type: Type.INTEGER, description: "Avancement VALIDATION CSP/TM (0-100)" },
    topographicStudy: {
      type: Type.OBJECT,
      properties: {
        label: { type: Type.STRING },
        progress: { type: Type.INTEGER },
        isPaid: { type: Type.BOOLEAN },
        attributaire: { type: Type.STRING }
      },
      required: ["label", "progress", "isPaid", "attributaire"]
    },
    geotechnicalStudy: {
      type: Type.OBJECT,
      properties: {
        label: { type: Type.STRING },
        progress: { type: Type.INTEGER },
        isPaid: { type: Type.BOOLEAN },
        attributaire: { type: Type.STRING }
      },
      required: ["label", "progress", "isPaid", "attributaire"]
    },
    stakeholders: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          role: { type: Type.STRING, description: "Architecte, BET ou BCT" },
          name: { type: Type.STRING },
          status: { type: Type.STRING },
          faxTel: { type: Type.STRING },
          email: { type: Type.STRING },
          nAoo: { type: Type.STRING },
          nMarche: { type: Type.STRING },
          documents: { type: Type.STRING },
          visitePrevue: { type: Type.STRING },
          dateOuverturePlis: { type: Type.STRING },
          visa: { type: Type.STRING, description: "Uniquement pour le BCT" },
          notice: { type: Type.STRING, description: "Uniquement pour le BET" }
        },
        required: ["role", "name", "status"]
      }
    },
    phases: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          value: { type: Type.STRING }
        },
        required: ["label", "value"]
      }
    },
    startDate: { type: Type.STRING, description: "DATE DEBUT DES TRAVAUX (JJ/MM/AAAA)" },
    delaiPrevisionnel: { type: Type.STRING, description: "Délai prévisionnel (ex: 8 MOIS)" },
    financialEstimation: { type: Type.STRING, description: "Estimation (ex: 6M DHS)" },
    description: { type: Type.STRING, description: "Description des travaux" },
    projectManager: { type: Type.STRING, description: "Chef de projet" },
    technicalRemarks: { type: Type.STRING, description: "Remarques techniques" },
    entrepriseVisite: { type: Type.STRING, description: "Visite prévue entreprise" },
    entrepriseOuverturePlis: { type: Type.STRING, description: "Date ouverture plis entreprise" },
    entrepriseNAoo: { type: Type.STRING, description: "N AOO ENTREPRISE" },
    entrepriseNMarche: { type: Type.STRING, description: "N MARCHE ENTREPRISE" },
    travauxLances: { type: Type.STRING, description: "Travaux lancés" },
    progressTravaux: { type: Type.INTEGER, description: "AVANCEMENT DES TRAVAUX (0-100)" },
    entrepriseTel: { type: Type.STRING, description: "TEL Entreprise" },
    entrepriseEmail: { type: Type.STRING, description: "EMAIL Entreprise" },
    autorisation: { type: Type.STRING, description: "Colonne AUTORISATION" },
    paiement: { type: Type.STRING, description: "Colonne PAIEMENT" },
    dce: { type: Type.STRING, description: "Colonne DCE" },
    bet_name: { type: Type.STRING, description: "VALEUR DE LA COLONNE 'BET' (Différent du BCT)" },
    bct_name: { type: Type.STRING, description: "VALEUR DE LA COLONNE 'BCT' (Différent du BET)" },
    arch_name: { type: Type.STRING, description: "VALEUR DE LA COLONNE 'ARCHITECTE'" },
    maps: { type: Type.STRING, description: "VALEUR DE LA COLONNE 'maps' (Lien Google Maps ou Coordonnées)" },
    totalDecomptes: { type: Type.NUMBER, description: "Somme de toutes les colonnes 'décompte 1', 'décompte 2', etc." }
  },
  required: [
    "name", "convention", "progressEtude", "progressCPS", "progressValidation",
    "topographicStudy", "geotechnicalStudy", "stakeholders", "phases", "bet_name", "bct_name"
  ]
};

const SYSTEM_RULES = `Expert en extraction DGPC. Règles :
1. MAPPING ENTREPRISE :
   - 'travauxLances' -> "Travaux lancés"
   - 'progressTravaux' -> "AVANCEMENT DES TRAVAUX"
   - 'entrepriseVisite' -> "Visite prévue entreprise"
   - 'entrepriseOuverturePlis' -> "Date ouverture plis entreprise"
   - 'entrepriseNAoo' -> "N AOO ENTREPRISE"
   - 'entrepriseNMarche' -> "N MARCHE ENTREPRISE"
   - 'startDate' -> "DATE DEBUT DES TRAVAUX"
   - 'delaiPrevisionnel' -> "Délai prévisionnel"
   - 'financialEstimation' -> "Estimation"
   - 'description' -> "Description des travaux"
   - 'entreprise' -> "ENTREPRISE Attributaire"
   - 'autorisation' -> Colonne "AUTORISATION" (Prends la valeur de statut comme "ACHEVE", "EN COURS", "FAVORABLE", "OUI", "NON". Ne pas prendre une date).
   - 'paiement' -> Colonne "PAIEMENT" (Prends la valeur de statut. Ne pas confondre avec d'autres colonnes de montants).
   - 'dce' -> Colonne "DCE" (Prends la valeur de statut du Dossier de Consultation).
   - IMPORTANT: Ces trois colonnes (AUTORISATION, PAIEMENT, DCE) sont souvent consécutives. Si une colonne contient une date, ce n'est probablement pas la bonne colonne pour ces champs de statut.
   - ATTENTION: Ne pas décaler les valeurs. Si une colonne est vide, mets "--".

2. INTERVENANTS (STRICT) :
   - 'arch_name' -> Colonne "ARCHITECTE"
   - 'bet_name' -> Colonne "BET"
   - 'bct_name' -> Colonne "BCT"
   - 'maps' -> Colonne "maps"
   - 'totalDecomptes' -> Calcule la somme de toutes les colonnes "décompte X".
   - IMPORTANT: Les colonnes "BET" et "BCT" sont distinctes. Ne pas mettre le nom du BET dans le champ BCT.

3. STATUTS INTERVENANTS (OBLIGATOIRE) :
   - Pour l'Architecte, le statut doit être l'un de : "sans architecte", "achève", "en cours", "pas en cours".
   - Si la valeur est "S/A", "S.A", "SA" ou vide, mappe-la vers "sans architecte".
   - Pour le BET et le BCT, le statut doit être l'un de : "achève", "en cours", "pas en cours".
   - Si le statut dans le sheet est différent, mappe-le vers le plus proche parmi ces options.

4. RÈGLES GÉNÉRALES :
   - Dates: JJ/MM/AAAA ou "--".
   - Si une colonne est vide, utilise "--".
   - Phases: Objet 'phases' doit avoir label="AUTORISATION", "PAIEMENT", "DCE" avec les valeurs exactes du sheet.
   - Stakeholders: Assure-toi que l'objet 'stakeholders' contient 3 entrées : "Architecte", "BET", "BCT".
   - Extrais TOUT sans exception.`;

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = JSON.stringify(error).toLowerCase();
    const isQuotaError = errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('resource_exhausted');
    if (retries > 0 && isQuotaError) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 1.5);
    }
    throw error;
  }
}

export const extractProjectDataFromExcelContent = async (textData: string): Promise<ProjectData[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
  
  // تنظيف الـ CSV وتقسيمه إلى صفوف
  const rows = textData.split('\n').filter(row => row.trim() !== '');
  if (rows.length === 0) return [];
  
  const header = rows[0];
  const dataRows = rows.slice(1);
  const chunkSize = 10;
  const allExtracted: ProjectData[] = [];

  for (let i = 0; i < dataRows.length; i += chunkSize) {
    const chunk = dataRows.slice(i, i + chunkSize);
    const chunkText = [header, ...chunk].join('\n');
    
    const prompt = `TRAITEMENT RAPIDE: Extrais TOUTES les lignes du CSV ci-dessous (Batch ${Math.floor(i/chunkSize) + 1}).
    Assure-toi de mapper correctement les dates d'entreprise.
    
    CSV :\n${chunkText}`;

    const batchResults = await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_RULES,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: SHARED_SCHEMA
          }
        }
      });

      const text = response.text;
      if (!text) return [];
      
      try {
          const rawJson = JSON.parse(text.trim());
          return rawJson.map((item: any) => {
            const phases = item.phases || [];
            if (phases.length === 0) {
              if (item.autorisation) phases.push({ label: "AUTORISATION", value: item.autorisation });
              if (item.paiement) phases.push({ label: "PAIEMENT", value: item.paiement });
              if (item.dce) phases.push({ label: "DCE", value: item.dce });
            }

            let stakeholders = item.stakeholders || [];
            const roles = ["ARCHITECTE", "BET", "BCT"];
            roles.forEach(role => {
              if (!stakeholders.find((s: any) => s.role.toUpperCase().includes(role))) {
                stakeholders.push({ role, name: "--", status: "NON SPÉCIFIÉ" });
              }
            });

            stakeholders.forEach((s: any) => {
              const r = s.role.toUpperCase();
              if (r.includes("BCT")) {
                if (item.bct_name) s.name = item.bct_name;
              } else if (r.includes("BET")) {
                if (item.bet_name) s.name = item.bet_name;
              } else if (r.includes("ARCHI")) {
                if (item.arch_name) s.name = item.arch_name;
              }
            });
            
            return {
              ...item,
              phases,
              stakeholders,
              id: item.name.replace(/\s+/g, '-').toLowerCase() + Math.random().toString(36).substr(2, 4),
              lastUpdated: new Date().toISOString()
            };
          });
      } catch (e) {
          console.error("Erreur parsing batch:", e);
          return [];
      }
    });
    
    allExtracted.push(...batchResults);
  }

  return allExtracted;
};
