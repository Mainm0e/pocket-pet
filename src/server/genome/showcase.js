// Known codes for each rare result (found by brute force). Used by the Seed Lab and the tests.
export const SHOWCASE_BY_SPECIES = {
  mochi: {
    tail_puff: 'MO1-1', tail_curl: 'MO1-36', tail_crystal: 'MO1-1L', tail_flame: 'MO1-30',
    wings_feather: 'MO1-4', wings_bat: 'MO1-2H', wings_butterfly: 'MO1-K', wings_angel: 'MO1-1G',
    head_flower: 'MO1-0', head_star: 'MO1-G', head_crystal: 'MO1-5', head_unicorn: 'MO1-3E',
    shiny: 'MO1-Y', hetero: 'MO1-2W',
    starry: 'MO1-F4E', choco: 'MO1-F9', cube: 'MO1-S10', drop: 'MO1-S8',
  },
  shiba: {
    tail_fox: 'SH1-W', tail_double: 'SH1-E', tail_crystal: 'SH1-26', tail_flame: 'SH1-3A',
    wings_feather: 'SH1-Z', wings_bat: 'SH1-B', wings_butterfly: 'SH1-13', wings_angel: 'SH1-C',
    head_flower: 'SH1-H', head_star: 'SH1-R', head_crystal: 'SH1-0', head_unicorn: 'SH1-17',
    shiny: 'SH1-1J', hetero: 'SH1-P',
  },
};
/** The current season's showcase (Seed Lab default). */
export const SHOWCASE = SHOWCASE_BY_SPECIES.mochi;
