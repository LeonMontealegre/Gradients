
// Shuffles the colors in each column
//  but keep the first color in each column in-place
// It's assumed that each column has the same number of colors, `numCols`
function ShuffleColors(colors, numCols) {
    const flattenedColors = colors.flat();

    const colIndices = colors.map((_, i) => (i * numCols));

    // Filter out the first colors
    const otherColors = flattenedColors.filter((_, j) => !(colIndices.includes(j)));

    // Shuffle the other colors
    const shuffledColors = ShuffleArray(otherColors);

    // Return array of color columns w/ shuffled colors and first original color back
    return Array(colors.length).fill(0)
        .map((_, i) => [colors[i][0], ...shuffledColors.splice(0, numCols-1)]);
}

function CreateGradientColors(amt, h1, h2, s, l) {
    return Array(amt).fill(0)
        .map((_, i) => (h1 + i/(amt-1)*(h2 - h1)))
        .map((h) => HSLToRGB(h, s, l))
        .map(({r,g,b}) => `rgb(${r}, ${g}, ${b})`);
}

function GenerateRandomGradients(amt, numColors, range, overlap, variance, s=0.25, l=0.50) {
    // Generate random initial hue
    const hue0 = Rand(0, 1);

    // Generate uniformly spaced hues across the space
    const initialHues = Array(amt).fill(0)
        .map((_, i) => ((i / amt + hue0) % 1.0))
        // Scale together towards hue0 to increase overlap
        .map(h => ((h - hue0) * (1 - overlap) + hue0));

    // Now use the ranges and initial hue to generate random hues within each range
    const hues = initialHues
        .map((hue) => (hue + variance * Rand(-range/4, range/4)));

    console.log(hues.map(h => [h, h+range]));

    return hues.map((hue1) => CreateGradientColors(numColors, hue1, hue1+range, s, l));
}

function CreateCard(container, color, onClickListener) {
    const card = document.createElement("div"); // Create element
    container.appendChild(card); // Append to container
    card.style.backgroundColor = color; // Set background color
    card.addEventListener("click", () => onClickListener(card));
    return card;
}

function CollapseGradient(cardsContainer, cards, i) {
    // Set column to be actual gradient for background
    const colors = cards[i].map(card => card.style.backgroundColor);
    cardsContainer.children[i].style.backgroundImage = `linear-gradient(${colors[0]}, ${colors.at(-1)})`;

    // Hide each card
    cards[i].forEach(card => card.classList.add("hidden"));
}

function CalcParAndBestSwaps(solution, shuffled) {
    const flattenedSol = solution.flat();
    const flattenedShuffle = shuffled.flat();

    const N = flattenedSol.length;

    const worst = N-1; // <- worst case scenario is the number of cards in total - 1

    // Best is calculated by getting the total number of cycles
    const best = (() => {
        // Generate mapping of shuffled array to solution
        const map = new Map();
        for (let i = 0; i < N; i++)
            map.set(flattenedShuffle[i], i);

        const visited = Array(N).fill(false);

        let ans = 0;
        for (let i = 0; i < N; i++) {
            // If visited or already correct
            if (visited[i] || map.get(flattenedSol[i]) === i)
                continue;

            let j = i, cycleSize = 0;
            while (!visited[j]) {
                visited[j] = true;

                // Move on to next node
                j = map.get(flattenedSol[j]);
                cycleSize++;
            }

            // Update answer
            if (cycleSize > 0)
                ans += (cycleSize - 1);
        }

        return ans;
    })();

    const par = worst/2 + best;

    return [par, best];
}


const container              = document.getElementById("container");
const button                 = document.getElementById("button");
const cardsContainer         = document.getElementById("card-columns");
const winText                = document.getElementById("win-text");
const numSwapsText           = document.getElementById("num-swaps-text");
const swapsInfoText          = document.getElementById("swaps-info-text");
const numColsSlider          = document.getElementById("num-cols-slider");
const numCardsSlider         = document.getElementById("num-cards-slider");
const gradientRangeSlider    = document.getElementById("gradient-range-slider");
const gradientOverlapSlider  = document.getElementById("gradient-overlap-slider");
const gradientVarianceSlider = document.getElementById("gradient-variance-slider");
const approxDifficultyText   = document.getElementById("approx-difficulty");


const MAX_COLUMNS = 5;
const MAX_CARDS = 40;
const MIN_RANGE = 15 / 360;
const MAX_OVERLAP = 355 / 360;
const MIN_VARIANCE = 0;

function CalcScore() {
    const numCols  = numColsSlider.valueAsNumber;
    const numCards = numCardsSlider.valueAsNumber;
    const range    = gradientRangeSlider.valueAsNumber / 360.0;
    const overlap  = gradientOverlapSlider.valueAsNumber / 360.0;
    const variance = gradientVarianceSlider?.valueAsNumber ?? 0.3;

    const normalize = (x, min, max) => ((x - min) / (max - min));
    const calcScore = (numCols, numCards, range, overlap) =>
        (20*numCols + 30*(numCards**3) + 20*(range**9) + 10*overlap*numCols);

    // Variance barely matters
    // Overlap matters but, 0 overlap w/ 5 columns and 40 cards w/ 5 range should still be very hard

    const max = calcScore(1, 1, 1, 1);

    const cur = calcScore(
            normalize(numCols,  1,      5),
            normalize(numCards, 5,      40),
        1 - normalize(range,    15/360, 120/360),
            normalize(overlap,  0/360,  355/360),
    );

    const CUTOFFS = [
        [5, "Very Easy"],
        [15, "Easy"],
        [25, "Medium"],
        [35, "Hard"],
        [60, "Very Hard"],
        [75, "Insane"],
        [100, "Impossible"],
    ];

    const getDifficulty = (score) => {
        for (const [cutoff, label] of CUTOFFS) {
            if (score <= cutoff)
                return label;
        }
    }

    // HARDEST POSSIBLE
    //  numCols: max, numCards: max, range: min, overlap: max, variance: min

    // EASIEST POSSIBLE
    //  numCols: min, numCards: min, range: max, overlap: N/A, variance: N/A

    // EASIEST POSSIBLE: numCards: min, overlap: 0, variance: 0,
    //   by numCards : range:
    //  2: ~135
    //  3: ~95
    //  4: ~75
    //  5: ~60

    // A large range is always easier
    //  Except for when there are multiple columns, (range > 1/numCols)
    // A wide range is difficult for more columns
    // Short range is always harder then large range

    // Overlap matters less the less columns there are
    //  (matters nothing for 1 column)

    // Variance changes very little other then adding some randomness
    //  but could make it slightly easier when overlap is high and columns are high

    approxDifficultyText.innerHTML = `${getDifficulty(cur/max*100)}`;
}

[numColsSlider, numCardsSlider, gradientRangeSlider,
 gradientOverlapSlider, gradientVarianceSlider].forEach(c => c?.addEventListener("input", CalcScore));
CalcScore();

function GenerateGradientCards() {
    // Clear container
    cardsContainer.innerHTML = "";

    // Hide win text and reset number of swaps
    winText.style.opacity = "0";
    numSwapsText.innerHTML = "Num Swaps: 0";

    // Get user-set values
    const numCols  = numColsSlider.valueAsNumber;
    const numCards = numCardsSlider.valueAsNumber;
    const range    = gradientRangeSlider.valueAsNumber / 360.0;
    const overlap  = gradientOverlapSlider.valueAsNumber / 360.0;
    const variance = gradientVarianceSlider?.valueAsNumber ?? 0.3;

    // Generate gradient colors for each column
    const colors = GenerateRandomGradients(numCols, numCards, range, overlap, variance);

    // Shuffle colors
    const shuffledColors = ShuffleColors(colors, numCards);

    // Calculate par and best possible number of swaps values
    const [par, best] = CalcParAndBestSwaps(colors, shuffledColors);
    swapsInfoText.innerHTML = `Par: ${par}, Least: ${best}`;

    // Keep track of currently active card (clicked card for swapping)
    let activeCard = undefined;

    // Keep track of number of swaps
    let numSwaps = 0;

    // Create each card and column
    const allCards = shuffledColors.map((cols) => {
        const column = cardsContainer.appendChild(document.createElement("div"));

        return cols.map((col, i) => CreateCard(column, col, (card) => {
            if (i === 0) // Don't do anything for first-card
                return;

            // Check if another card is already active
            if (!activeCard) {
                card.classList.add("active");
                activeCard = card;
                return;
            }
            // Remove data
            activeCard.classList.remove("active");

            // Swap the two card colors
            const tmp = card.style.backgroundColor;
            card.style.backgroundColor = activeCard.style.backgroundColor;
            activeCard.style.backgroundColor = tmp;

            if (card !== activeCard) {
                numSwaps++;
                numSwapsText.innerHTML = `Num Swaps: ${numSwaps}`;
            }

            activeCard = undefined;

            // Check for if a column is finished
            const curColors = allCards.map(cards => (cards.map(c => c.style.backgroundColor)));
            allCards.forEach((_, i) => {
                if (ArraysEqual(colors[i], curColors[i]))
                    CollapseGradient(cardsContainer, allCards, i);
            });

            // Check for win (show winning text)
            if (allCards.every((_, i) => ArraysEqual(colors[i], curColors[i])))
                winText.style.opacity = "1";
        }))
    });

    // // Show each correct position as data labels
    // allCards.forEach(col => {
    //     col.forEach(card => {
    //         const color = card.style.backgroundColor;
    //         const i = colors.findIndex(gradient => gradient.includes(color));
    //         const j = colors[i].indexOf(color);

    //         card.dataset["pos"] = `${i},${j}`;
    //     });
    // })
}

button.addEventListener("click", GenerateGradientCards);

GenerateGradientCards();
