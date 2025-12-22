import { 
  Hotel, 
  Utensils, 
  Landmark, 
  TreePine, 
  ShoppingBag, 
  Bus, 
  MapPin,
  Coffee,
  Camera,
  Music,
  Beer,
  Castle,
  Ticket
} from "lucide-react";

export const CATEGORY_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  // Hospedagem
  "hospedagem": { color: "#F43F5E", icon: Hotel, label: "Hospedagem" }, // Rose
  "hotel": { color: "#F43F5E", icon: Hotel, label: "Hotel" },
  
  // Gastronomia
  "gastronomia": { color: "#F97316", icon: Utensils, label: "Gastronomia" }, // Orange
  "restaurante": { color: "#F97316", icon: Utensils, label: "Restaurante" },
  "comida": { color: "#F97316", icon: Utensils, label: "Comida" },
  "cafe": { color: "#D97706", icon: Coffee, label: "Café" }, // Amber
  "bar": { color: "#EAB308", icon: Beer, label: "Bar" }, // Yellow
  
  // Cultura
  "cultura": { color: "#8B5CF6", icon: Landmark, label: "Cultura" }, // Violet
  "museu": { color: "#8B5CF6", icon: Landmark, label: "Museu" },
  "arte": { color: "#A855F7", icon: Music, label: "Arte" }, // Purple
  "teatro": { color: "#A855F7", icon: Music, label: "Teatro" },

  // História
  "história": { color: "#EA580C", icon: Castle, label: "História" }, // Burnt Orange
  "historia": { color: "#EA580C", icon: Castle, label: "História" },
  "monumento": { color: "#EA580C", icon: Castle, label: "Monumento" },
  "igreja": { color: "#EA580C", icon: Castle, label: "Igreja" },
  
  // Natureza
  "natureza": { color: "#10B981", icon: TreePine, label: "Natureza" }, // Emerald
  "parque": { color: "#10B981", icon: TreePine, label: "Parque" },
  
  // Compras
  "compras": { color: "#EC4899", icon: ShoppingBag, label: "Compras" }, // Pink
  
  // Transporte
  "transporte": { color: "#3B82F6", icon: Bus, label: "Transporte" }, // Blue
  
  // Turismo
  "turismo": { color: "#06B6D4", icon: Camera, label: "Turismo" }, // Cyan
  
  // Entretenimento
  "entretenimento": { color: "#F59E0B", icon: Ticket, label: "Entretenimento" }, // Amber

  "default": { color: "#64748B", icon: MapPin, label: "Outros" } // Slate
};

export const getCategoryConfig = (category?: string) => {
  if (!category) return CATEGORY_CONFIG["default"];
  const normalized = category.toLowerCase().trim();
  
  // Direct match
  if (CATEGORY_CONFIG[normalized]) return CATEGORY_CONFIG[normalized];
  
  // Partial match keys
  const key = Object.keys(CATEGORY_CONFIG).find(k => normalized.includes(k));
  return key ? CATEGORY_CONFIG[key] : CATEGORY_CONFIG["default"];
};
