import type { PlaceCategory } from "./categories"

// Google Places (New) primary types → canonical category. First match wins, so
// specific types come before generic ones.
const RULES: [PlaceCategory, string[]][] = [
  ["hospedagem", ["lodging", "hotel", "hostel", "motel", "resort_hotel", "bed_and_breakfast", "guest_house", "campground"]],
  ["transporte", ["airport", "train_station", "bus_station", "subway_station", "transit_station", "light_rail_station", "ferry_terminal", "car_rental"]],
  ["historia", ["historical_landmark", "historical_place", "monument", "church", "place_of_worship", "castle", "cathedral", "mosque", "synagogue", "hindu_temple"]],
  ["cultura", ["museum", "art_gallery", "performing_arts_theater", "library", "cultural_center", "opera_house", "concert_hall"]],
  ["entretenimento", ["amusement_park", "aquarium", "zoo", "night_club", "movie_theater", "stadium", "casino", "bowling_alley", "water_park"]],
  ["natureza", ["park", "national_park", "natural_feature", "beach", "hiking_area", "garden", "botanical_garden", "lake", "dog_park"]],
  ["gastronomia", ["restaurant", "cafe", "coffee_shop", "bar", "bakery", "food", "meal_takeaway", "ice_cream_shop", "wine_bar", "pub"]],
  ["compras", ["shopping_mall", "market", "store", "clothing_store", "book_store", "supermarket", "gift_shop", "department_store"]],
  ["turismo", ["tourist_attraction", "observation_deck", "visitor_center", "plaza", "point_of_interest"]],
]

export function categoryFromGoogleTypes(types: readonly string[] | null | undefined): PlaceCategory {
  const set = new Set(types ?? [])
  for (const [category, keys] of RULES) if (keys.some((k) => set.has(k))) return category
  return "outros"
}

type AddressComponent = { longText?: string | null; types?: readonly string[] | null }

/** City from Places address components (locality, then postal town / admin level 2). */
export function cityFromAddressComponents(components: readonly AddressComponent[] | null | undefined): string | undefined {
  for (const type of ["locality", "postal_town", "administrative_area_level_2"]) {
    const found = components?.find((c) => c.types?.includes(type))?.longText
    if (found) return found
  }
  return undefined
}
