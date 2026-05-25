// SVG 1.1 named colors ("extended colors" web palette — 147 entries).
//
// Stored once, exposed as both a flat list (UI iteration order matches
// the W3C swatch chart, grouped by hue) and a lookup map (`COLOR_BY_NAME`).
//
// `darkText` is precomputed: true when the swatch's relative luminance
// is high enough that white text would lose contrast. The threshold is
// 0.55 — slightly above 0.5 to favour dark text on borderline mid-tones
// (Goldenrod, MediumSeaGreen) where white is technically readable but
// looks washed out.
//
// Names are canonical SVG/CSS spellings. The names are also valid CSS
// color values, so a chip can be styled with `background: Tomato;`
// directly — no hex lookup needed for styling, only for contrast.

export const SVG_COLORS = [
  // Pinks
  { name: 'Pink',                 hex: '#FFC0CB', darkText: true  },
  { name: 'LightPink',            hex: '#FFB6C1', darkText: true  },
  { name: 'HotPink',              hex: '#FF69B4', darkText: true  },
  { name: 'DeepPink',             hex: '#FF1493', darkText: false },
  { name: 'PaleVioletRed',        hex: '#DB7093', darkText: false },
  { name: 'MediumVioletRed',      hex: '#C71585', darkText: false },

  // Reds
  { name: 'LightSalmon',          hex: '#FFA07A', darkText: true  },
  { name: 'Salmon',               hex: '#FA8072', darkText: true  },
  { name: 'DarkSalmon',           hex: '#E9967A', darkText: true  },
  { name: 'LightCoral',           hex: '#F08080', darkText: true  },
  { name: 'IndianRed',            hex: '#CD5C5C', darkText: false },
  { name: 'Crimson',              hex: '#DC143C', darkText: false },
  { name: 'Firebrick',            hex: '#B22222', darkText: false },
  { name: 'DarkRed',              hex: '#8B0000', darkText: false },
  { name: 'Red',                  hex: '#FF0000', darkText: false },

  // Oranges
  { name: 'OrangeRed',            hex: '#FF4500', darkText: false },
  { name: 'Tomato',               hex: '#FF6347', darkText: false },
  { name: 'Coral',                hex: '#FF7F50', darkText: true  },
  { name: 'DarkOrange',           hex: '#FF8C00', darkText: true  },
  { name: 'Orange',               hex: '#FFA500', darkText: true  },

  // Yellows
  { name: 'Yellow',               hex: '#FFFF00', darkText: true  },
  { name: 'LightYellow',          hex: '#FFFFE0', darkText: true  },
  { name: 'LemonChiffon',         hex: '#FFFACD', darkText: true  },
  { name: 'LightGoldenrodYellow', hex: '#FAFAD2', darkText: true  },
  { name: 'PapayaWhip',           hex: '#FFEFD5', darkText: true  },
  { name: 'Moccasin',             hex: '#FFE4B5', darkText: true  },
  { name: 'PeachPuff',            hex: '#FFDAB9', darkText: true  },
  { name: 'PaleGoldenrod',        hex: '#EEE8AA', darkText: true  },
  { name: 'Khaki',                hex: '#F0E68C', darkText: true  },
  { name: 'DarkKhaki',            hex: '#BDB76B', darkText: true  },
  { name: 'Gold',                 hex: '#FFD700', darkText: true  },

  // Browns
  { name: 'Cornsilk',             hex: '#FFF8DC', darkText: true  },
  { name: 'BlanchedAlmond',       hex: '#FFEBCD', darkText: true  },
  { name: 'Bisque',               hex: '#FFE4C4', darkText: true  },
  { name: 'NavajoWhite',          hex: '#FFDEAD', darkText: true  },
  { name: 'Wheat',                hex: '#F5DEB3', darkText: true  },
  { name: 'Burlywood',            hex: '#DEB887', darkText: true  },
  { name: 'Tan',                  hex: '#D2B48C', darkText: true  },
  { name: 'RosyBrown',            hex: '#BC8F8F', darkText: true  },
  { name: 'SandyBrown',           hex: '#F4A460', darkText: true  },
  { name: 'Goldenrod',            hex: '#DAA520', darkText: true  },
  { name: 'DarkGoldenrod',        hex: '#B8860B', darkText: false },
  { name: 'Peru',                 hex: '#CD853F', darkText: false },
  { name: 'Chocolate',            hex: '#D2691E', darkText: false },
  { name: 'SaddleBrown',          hex: '#8B4513', darkText: false },
  { name: 'Sienna',               hex: '#A0522D', darkText: false },
  { name: 'Brown',                hex: '#A52A2A', darkText: false },
  { name: 'Maroon',               hex: '#800000', darkText: false },

  // Greens
  { name: 'DarkOliveGreen',       hex: '#556B2F', darkText: false },
  { name: 'Olive',                hex: '#808000', darkText: false },
  { name: 'OliveDrab',            hex: '#6B8E23', darkText: false },
  { name: 'YellowGreen',          hex: '#9ACD32', darkText: true  },
  { name: 'LimeGreen',            hex: '#32CD32', darkText: true  },
  { name: 'Lime',                 hex: '#00FF00', darkText: true  },
  { name: 'LawnGreen',            hex: '#7CFC00', darkText: true  },
  { name: 'Chartreuse',           hex: '#7FFF00', darkText: true  },
  { name: 'GreenYellow',          hex: '#ADFF2F', darkText: true  },
  { name: 'SpringGreen',          hex: '#00FF7F', darkText: true  },
  { name: 'MediumSpringGreen',    hex: '#00FA9A', darkText: true  },
  { name: 'LightGreen',           hex: '#90EE90', darkText: true  },
  { name: 'PaleGreen',            hex: '#98FB98', darkText: true  },
  { name: 'DarkSeaGreen',         hex: '#8FBC8F', darkText: true  },
  { name: 'MediumAquamarine',     hex: '#66CDAA', darkText: true  },
  { name: 'MediumSeaGreen',       hex: '#3CB371', darkText: true  },
  { name: 'SeaGreen',             hex: '#2E8B57', darkText: false },
  { name: 'ForestGreen',          hex: '#228B22', darkText: false },
  { name: 'Green',                hex: '#008000', darkText: false },
  { name: 'DarkGreen',            hex: '#006400', darkText: false },

  // Cyans
  { name: 'Aqua',                 hex: '#00FFFF', darkText: true  },
  { name: 'Cyan',                 hex: '#00FFFF', darkText: true  },
  { name: 'LightCyan',            hex: '#E0FFFF', darkText: true  },
  { name: 'PaleTurquoise',        hex: '#AFEEEE', darkText: true  },
  { name: 'Aquamarine',           hex: '#7FFFD4', darkText: true  },
  { name: 'Turquoise',            hex: '#40E0D0', darkText: true  },
  { name: 'MediumTurquoise',      hex: '#48D1CC', darkText: true  },
  { name: 'DarkTurquoise',        hex: '#00CED1', darkText: true  },
  { name: 'LightSeaGreen',        hex: '#20B2AA', darkText: false },
  { name: 'CadetBlue',            hex: '#5F9EA0', darkText: false },
  { name: 'DarkCyan',             hex: '#008B8B', darkText: false },
  { name: 'Teal',                 hex: '#008080', darkText: false },

  // Blues
  { name: 'LightSteelBlue',       hex: '#B0C4DE', darkText: true  },
  { name: 'PowderBlue',           hex: '#B0E0E6', darkText: true  },
  { name: 'LightBlue',            hex: '#ADD8E6', darkText: true  },
  { name: 'SkyBlue',              hex: '#87CEEB', darkText: true  },
  { name: 'LightSkyBlue',         hex: '#87CEFA', darkText: true  },
  { name: 'DeepSkyBlue',          hex: '#00BFFF', darkText: false },
  { name: 'DodgerBlue',           hex: '#1E90FF', darkText: false },
  { name: 'CornflowerBlue',       hex: '#6495ED', darkText: false },
  { name: 'SteelBlue',            hex: '#4682B4', darkText: false },
  { name: 'RoyalBlue',            hex: '#4169E1', darkText: false },
  { name: 'Blue',                 hex: '#0000FF', darkText: false },
  { name: 'MediumBlue',           hex: '#0000CD', darkText: false },
  { name: 'DarkBlue',             hex: '#00008B', darkText: false },
  { name: 'Navy',                 hex: '#000080', darkText: false },
  { name: 'MidnightBlue',         hex: '#191970', darkText: false },

  // Purples
  { name: 'Lavender',             hex: '#E6E6FA', darkText: true  },
  { name: 'Thistle',              hex: '#D8BFD8', darkText: true  },
  { name: 'Plum',                 hex: '#DDA0DD', darkText: true  },
  { name: 'Violet',               hex: '#EE82EE', darkText: true  },
  { name: 'Orchid',               hex: '#DA70D6', darkText: true  },
  { name: 'Fuchsia',              hex: '#FF00FF', darkText: false },
  { name: 'Magenta',              hex: '#FF00FF', darkText: false },
  { name: 'MediumOrchid',         hex: '#BA55D3', darkText: false },
  { name: 'MediumPurple',         hex: '#9370DB', darkText: false },
  { name: 'BlueViolet',           hex: '#8A2BE2', darkText: false },
  { name: 'DarkViolet',           hex: '#9400D3', darkText: false },
  { name: 'DarkOrchid',           hex: '#9932CC', darkText: false },
  { name: 'DarkMagenta',          hex: '#8B008B', darkText: false },
  { name: 'Purple',               hex: '#800080', darkText: false },
  { name: 'RebeccaPurple',        hex: '#663399', darkText: false },
  { name: 'Indigo',               hex: '#4B0082', darkText: false },
  { name: 'MediumSlateBlue',      hex: '#7B68EE', darkText: false },
  { name: 'SlateBlue',            hex: '#6A5ACD', darkText: false },
  { name: 'DarkSlateBlue',        hex: '#483D8B', darkText: false },

  // Whites
  { name: 'White',                hex: '#FFFFFF', darkText: true  },
  { name: 'Snow',                 hex: '#FFFAFA', darkText: true  },
  { name: 'Honeydew',             hex: '#F0FFF0', darkText: true  },
  { name: 'MintCream',            hex: '#F5FFFA', darkText: true  },
  { name: 'Azure',                hex: '#F0FFFF', darkText: true  },
  { name: 'AliceBlue',            hex: '#F0F8FF', darkText: true  },
  { name: 'GhostWhite',           hex: '#F8F8FF', darkText: true  },
  { name: 'WhiteSmoke',           hex: '#F5F5F5', darkText: true  },
  { name: 'Seashell',             hex: '#FFF5EE', darkText: true  },
  { name: 'Beige',                hex: '#F5F5DC', darkText: true  },
  { name: 'OldLace',              hex: '#FDF5E6', darkText: true  },
  { name: 'FloralWhite',          hex: '#FFFAF0', darkText: true  },
  { name: 'Ivory',                hex: '#FFFFF0', darkText: true  },
  { name: 'AntiqueWhite',         hex: '#FAEBD7', darkText: true  },
  { name: 'Linen',                hex: '#FAF0E6', darkText: true  },
  { name: 'LavenderBlush',        hex: '#FFF0F5', darkText: true  },
  { name: 'MistyRose',            hex: '#FFE4E1', darkText: true  },

  // Grays
  { name: 'Gainsboro',            hex: '#DCDCDC', darkText: true  },
  { name: 'LightGray',            hex: '#D3D3D3', darkText: true  },
  { name: 'LightGrey',            hex: '#D3D3D3', darkText: true  },
  { name: 'Silver',               hex: '#C0C0C0', darkText: true  },
  { name: 'DarkGray',             hex: '#A9A9A9', darkText: true  },
  { name: 'DarkGrey',             hex: '#A9A9A9', darkText: true  },
  { name: 'Gray',                 hex: '#808080', darkText: false },
  { name: 'Grey',                 hex: '#808080', darkText: false },
  { name: 'DimGray',              hex: '#696969', darkText: false },
  { name: 'DimGrey',              hex: '#696969', darkText: false },
  { name: 'LightSlateGray',       hex: '#778899', darkText: false },
  { name: 'LightSlateGrey',       hex: '#778899', darkText: false },
  { name: 'SlateGray',            hex: '#708090', darkText: false },
  { name: 'SlateGrey',            hex: '#708090', darkText: false },
  { name: 'DarkSlateGray',        hex: '#2F4F4F', darkText: false },
  { name: 'DarkSlateGrey',        hex: '#2F4F4F', darkText: false },
  { name: 'Black',                hex: '#000000', darkText: false },
];

export const COLOR_BY_NAME = new Map(
  SVG_COLORS.map((c) => [c.name.toLowerCase(), c])
);

// Look up a swatch by its name, case-insensitively. Returns `null` for
// unknown / unset values so callers can fall back to the default chip
// style without having to special-case empty strings.
export function lookupColor(name) {
  if (!name) return null;
  return COLOR_BY_NAME.get(String(name).toLowerCase()) || null;
}
