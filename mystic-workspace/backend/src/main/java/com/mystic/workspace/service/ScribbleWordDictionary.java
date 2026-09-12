package com.mystic.workspace.service;

import com.mystic.workspace.dto.ScribbleDtos.Difficulty;
import com.mystic.workspace.dto.ScribbleDtos.WordOption;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class ScribbleWordDictionary {

    private final List<WordOption> easyWords = new ArrayList<>();
    private final List<WordOption> mediumWords = new ArrayList<>();
    private final List<WordOption> hardWords = new ArrayList<>();
    private final Random random = new Random();

    public ScribbleWordDictionary() {
        initDictionary();
    }

    private void initDictionary() {
        // --- EASY WORDS (Familiar items, animals, basic shapes) ---
        addWord(Difficulty.EASY, "APPLE", "A common red or green fruit");
        addWord(Difficulty.EASY, "CAT", "Feline domestic pet");
        addWord(Difficulty.EASY, "DOG", "Man's best friend");
        addWord(Difficulty.EASY, "SUN", "The star at the center of the solar system");
        addWord(Difficulty.EASY, "TREE", "Woody perennial plant with leaves");
        addWord(Difficulty.EASY, "HOUSE", "A building for human habitation");
        addWord(Difficulty.EASY, "CAR", "Four-wheeled motor vehicle");
        addWord(Difficulty.EASY, "FISH", "Aquatic animal with gills and fins");
        addWord(Difficulty.EASY, "STAR", "Twinkling luminous point in night sky");
        addWord(Difficulty.EASY, "MOON", "Earth's natural satellite");
        addWord(Difficulty.EASY, "BOOK", "Written or printed work of pages");
        addWord(Difficulty.EASY, "CLOCK", "Instrument measuring and showing time");
        addWord(Difficulty.EASY, "CHAIR", "A separate seat for one person");
        addWord(Difficulty.EASY, "BALL", "Spherical object used in sports/games");
        addWord(Difficulty.EASY, "PENCIL", "Instrument for writing or drawing");
        addWord(Difficulty.EASY, "PIZZA", "Italian dish with cheese and toppings");
        addWord(Difficulty.EASY, "SMILE", "Facial expression showing pleasure");
        addWord(Difficulty.EASY, "HEART", "Organ that pumps blood or love symbol");
        addWord(Difficulty.EASY, "BOAT", "Watercraft designed to float");
        addWord(Difficulty.EASY, "BIRD", "Warm-blooded egg-laying vertebrate with feathers");
        addWord(Difficulty.EASY, "CLOUD", "Visible mass of condensed water vapor in sky");
        addWord(Difficulty.EASY, "KEY", "Small metal instrument for locking/unlocking");
        addWord(Difficulty.EASY, "ICE CREAM", "Frozen sweet food typically eaten as dessert");
        addWord(Difficulty.EASY, "FLOWER", "Seed-bearing part of a plant with colorful petals");
        addWord(Difficulty.EASY, "HAT", "Shaped covering for the head");

        // --- MEDIUM WORDS (Objects, actions, places, professions) ---
        addWord(Difficulty.MEDIUM, "PENGUIN", "Flightless bird living in cold southern hemisphere");
        addWord(Difficulty.MEDIUM, "ROCKET", "Cylindrical projectile or spacecraft");
        addWord(Difficulty.MEDIUM, "CASTLE", "Large fortified building of medieval times");
        addWord(Difficulty.MEDIUM, "GUITAR", "Stringed musical instrument with frets");
        addWord(Difficulty.MEDIUM, "BICYCLE", "Vehicle with two wheels powered by pedals");
        addWord(Difficulty.MEDIUM, "VOLCANO", "Mountain or hill with a crater erupting lava");
        addWord(Difficulty.MEDIUM, "TELESCOPE", "Optical instrument for viewing distant stars");
        addWord(Difficulty.MEDIUM, "OCTOPUS", "Eight-limbed sea mollusk with suction cups");
        addWord(Difficulty.MEDIUM, "HELICOPTER", "Aircraft with horizontal rotating blades");
        addWord(Difficulty.MEDIUM, "MICROSCOPE", "Optical instrument for viewing tiny organisms");
        addWord(Difficulty.MEDIUM, "SANDWICH", "Food item with fillings between slices of bread");
        addWord(Difficulty.MEDIUM, "SNOWMAN", "Figure made of packed snow with carrot nose");
        addWord(Difficulty.MEDIUM, "CAMPFIRE", "Outdoor fire at a campsite");
        addWord(Difficulty.MEDIUM, "LIGHTHOUSE", "Tower with a beacon light to guide ships");
        addWord(Difficulty.MEDIUM, "DRAGON", "Mythical monster resembling a giant reptile");
        addWord(Difficulty.MEDIUM, "RAINBOW", "Arch of colors formed in the sky by rain & sun");
        addWord(Difficulty.MEDIUM, "SATELLITE", "Artificial body placed in orbit around earth");
        addWord(Difficulty.MEDIUM, "WINDMILL", "Building with sails or vanes turned by the wind");
        addWord(Difficulty.MEDIUM, "TREASURE", "Quantity of precious metals or gems");
        addWord(Difficulty.MEDIUM, "ASTRONAUT", "Person trained to travel in a spacecraft");
        addWord(Difficulty.MEDIUM, "SUBMARINE", "Watercraft capable of independent underwater operation");
        addWord(Difficulty.MEDIUM, "WATERFALL", "Cascade of water falling from a height");
        addWord(Difficulty.MEDIUM, "FIRETRUCK", "Vehicle carrying firefighters and equipment");
        addWord(Difficulty.MEDIUM, "PIRATE", "Person who attacks and robs ships at sea");
        addWord(Difficulty.MEDIUM, "COMPASS", "Instrument containing a magnetized pointer for direction");

        // --- HARD WORDS (Abstract concepts, detailed items, tech, compound phrases) ---
        addWord(Difficulty.HARD, "LABYRINTH", "Complicated irregular network of passages or maze");
        addWord(Difficulty.HARD, "TIME MACHINE", "Fictional apparatus for traveling through eras");
        addWord(Difficulty.HARD, "BLACK HOLE", "Region of space having a gravitational field so intense no matter escapes");
        addWord(Difficulty.HARD, "GRAVITY", "Force that attracts a body toward the centre of the earth");
        addWord(Difficulty.HARD, "DNA STRAND", "Double helix molecule carrying genetic code");
        addWord(Difficulty.HARD, "HOLOGRAM", "Three-dimensional image formed by light interference");
        addWord(Difficulty.HARD, "AURORA BOREALIS", "Natural electrical light display in the polar sky");
        addWord(Difficulty.HARD, "METEOR SHOWER", "Celestial event where meteoroids enter earth's atmosphere");
        addWord(Difficulty.HARD, "SOLAR ECLIPSE", "Moon passes between Earth and the Sun, blocking sunlight");
        addWord(Difficulty.HARD, "CYBERPUNK", "Subgenre of science fiction in a futuristic dystopia");
        addWord(Difficulty.HARD, "QUANTUM COMPUTER", "Computer utilizing quantum mechanics for fast calculations");
        addWord(Difficulty.HARD, "CHAMELEON", "Lizard capable of changing skin color");
        addWord(Difficulty.HARD, "METAMORPHOSIS", "Biological transformation from larva to adult");
        addWord(Difficulty.HARD, "KALEIDOSCOPE", "Optical toy producing symmetrical colorful patterns");
        addWord(Difficulty.HARD, "CONSTELLATION", "Group of stars forming a recognizable pattern");
        addWord(Difficulty.HARD, "ROLLER COASTER", "Amusement park track ride with sharp turns and slopes");
        addWord(Difficulty.HARD, "UNDERWATER RUINS", "Sunken ancient city or submerged historical artifacts");
        addWord(Difficulty.HARD, "SUPERNOVA", "Powerful and luminous stellar explosion");
        addWord(Difficulty.HARD, "HYPNOSIS", "State of human consciousness involving focused attention");
        addWord(Difficulty.HARD, "PARACHUTE", "Cloth canopy deployed to slow descent from an aircraft");
    }

    private void addWord(Difficulty diff, String word, String hint) {
        WordOption opt = WordOption.builder()
                .word(word.toUpperCase())
                .difficulty(diff)
                .hint(hint)
                .build();
        switch (diff) {
            case EASY -> easyWords.add(opt);
            case MEDIUM -> mediumWords.add(opt);
            case HARD -> hardWords.add(opt);
        }
    }

    /**
     * Selects 3 distinct random word options: 1 Easy, 1 Medium, 1 Hard.
     */
    public List<WordOption> getThreeRandomOptions() {
        WordOption easy = easyWords.get(random.nextInt(easyWords.size()));
        WordOption med = mediumWords.get(random.nextInt(mediumWords.size()));
        WordOption hard = hardWords.get(random.nextInt(hardWords.size()));
        return List.of(easy, med, hard);
    }

    public WordOption getRandomWord() {
        int r = random.nextInt(3);
        if (r == 0) return easyWords.get(random.nextInt(easyWords.size()));
        if (r == 1) return mediumWords.get(random.nextInt(mediumWords.size()));
        return hardWords.get(random.nextInt(hardWords.size()));
    }
}
