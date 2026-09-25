// Map of top-tier Indian holiday destinations and their base tourism score (0-100)
// This acts as a prior to boost famous destinations above obscure towns that happen
// to have many places in the DB (like residential suburbs).

export const TOURISM_PRIOR_SCORES: Record<string, number> = {
  // Mountains & Valleys
  "Manali": 100,
  "Shimla": 95,
  "Leh": 100,
  "Munnar": 95,
  "Darjeeling": 90,
  "Ooty": 90,
  "Nainital": 85,
  "Mussoorie": 85,
  "Srinagar": 90,
  "Gulmarg": 85,
  "Pahalgam": 80,
  "Kodaikanal": 80,
  "Coorg": 90,
  "Wayanad": 85,
  "Gangtok": 85,
  "Shillong": 80,
  "Tawang": 75,
  "Dalhousie": 80,
  "Auli": 75,
  
  // Beaches & Coast
  "Goa": 100,
  "Andaman and Nicobar Islands": 95,
  "Havelock Island": 90,
  "Gokarna": 85,
  "Varkala": 80,
  "Pondicherry": 90,
  "Kovalam": 80,
  "Puri": 75,
  "Mahabalipuram": 75,

  // Heritage & History
  "Jaipur": 100,
  "Udaipur": 100,
  "Agra": 100,
  "Varanasi": 95,
  "Jodhpur": 90,
  "Jaisalmer": 90,
  "Hampi": 95,
  "Khajuraho": 85,
  "Ajanta and Ellora Caves": 85,
  "Mysore": 85,
  "Amritsar": 90,
  "Bikaner": 80,
  "Pushkar": 85,
  "Gwalior": 75,
  "Orchha": 75,

  // Nature & Wildlife
  "Ranthambore National Park": 90,
  "Jim Corbett National Park": 90,
  "Kaziranga National Park": 85,
  "Bandhavgarh National Park": 80,
  "Kanha National Park": 80,
  "Sundarbans": 80,
  "Gir National Park": 80,
  "Periyar National Park": 80,
  "Matheran": 75,
  "Lonavala": 80,
  "Mahabaleshwar": 80,
  "Cherrapunji": 80,
  "Mawlynnong": 75,

  // Spiritual
  "Rishikesh": 95,
  "Haridwar": 90,
  "Vrindavan": 85,
  "Mathura": 85,
  "Tirupati": 80,
  "Madurai": 80,
  "Rameshwaram": 80,
  "Dwarka": 80,
  "Somnath": 75,
  "Kedarnath": 90,
  "Badrinath": 85,
  "Shirdi": 80,
  "Maha Kumbh Mela": 80,

  // Backwaters
  "Alleppey": 95,
  "Kumarakom": 85,

  // Urban/Metro (lower base for tourism compared to dedicated destinations)
  "Delhi": 90,
  "Mumbai": 90,
  "Bangalore": 80,
  "Chennai": 80,
  "Kolkata": 85,
  "Hyderabad": 80,
  "Pune": 70,
  "Ahmedabad": 75,
  "Chandigarh": 75,
};

/**
 * Returns a SQL case statement to assign base tourism prominence scores based on destination name.
 */
export function getTourismProminenceSql(tableAlias: string = "d"): string {
  const cases = Object.entries(TOURISM_PRIOR_SCORES)
    .map(([name, score]) => `WHEN ${tableAlias}.name ILIKE '%${name.replace(/'/g, "''")}%' THEN ${score}`)
    .join(" ");

  return `
    (CASE 
      ${cases}
      ELSE 10
    END)
  `;
}
