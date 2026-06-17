// index.js

document.addEventListener(
  'DOMContentLoaded',
  async () => {

    try {

      const {
        sims,
        worlds,
        lots,
        families,
        pets
      } = await window.CSV.loadCSVs({

        sims: 'data/sims.csv',
        worlds: 'data/worlds.csv',
        lots: 'data/lots.csv',
        families: 'data/families.csv',
        pets: 'data/pets.csv'

      });

      const simCount =
        sims.filter(
          s => (s['NAME'] || '').trim()
        ).length;

      const worldCount =
        worlds.filter(
          w => (w['WORLD'] || '').trim()
        ).length;

      const lotCount =
        lots.filter(
          lot =>
            !(lot['PARENT LOT ID'] || '')
              .trim()
        ).length;

      const petCount = pets.filter(
        pet => (pet['NAME'] || '').trim()
      ).length;

      let familyCount = 0;

      if (families.length) {

        if (
          families[0].hasOwnProperty('FAMILY ID')
        ) {

          familyCount =
            new Set(

              families
                .map(
                  f => f['FAMILY ID']
                )
                .filter(Boolean)

            ).size;

        } else {

          familyCount =
            families.length;

        }

      }

      animateCount(
        'statSims',
        simCount
      );

      animateCount(
        'statWorlds',
        worldCount
      );

      animateCount(
        'statLots',
        lotCount
      );

      animateCount(
        'statFamilies',
        familyCount
      );

      // Also update card counts
      const cardSimCount = document.getElementById('cardSimCount');
      if (cardSimCount) cardSimCount.textContent = `${simCount} Sims`;

      const cardWorldCount = document.getElementById('cardWorldCount');
      if (cardWorldCount) cardWorldCount.textContent = `${worldCount} Worlds`;

      const cardLotCount = document.getElementById('cardLotCount');
      if (cardLotCount) cardLotCount.textContent = `${lotCount} Lots`;

      const cardPetCount = document.getElementById('cardPetCount');
      if (cardPetCount) cardPetCount.textContent = `${petCount} Pets`;

    } catch (err) {

      console.error(
        '[index.js]',
        err
      );

    }

  }
);

function animateCount(
  id,
  target
) {

  const el =
    document.getElementById(id);

  if (!el) return;

  if (!target) {

    el.textContent = '0';

    return;

  }

  const duration = 900;

  let start = null;

  function step(ts) {

    if (!start) {
      start = ts;
    }

    const progress =
      Math.min(
        (ts - start) / duration,
        1
      );

    el.textContent =
      Math.floor(
        progress * target
      );

    if (progress < 1) {

      requestAnimationFrame(
        step
      );

    } else {

      el.textContent =
        target.toLocaleString();

    }

  }

  requestAnimationFrame(step);

}