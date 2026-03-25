# GSPL Language Examples

## Basic Seed Creation

```gspl
seed Circle {
  domain: visual2d
  genes: {
    x: scalar = 50, min: 0, max: 100
    y: scalar = 50, min: 0, max: 100
    radius: scalar = 20, min: 1, max: 50
  }
}

seed Square extends Circle {
  domain: visual2d
  genes: {
    width: scalar = 40, min: 10, max: 100
    height: scalar = 40, min: 10, max: 100
  }
}
```

## Control Flow

```gspl
fn factorial(n) {
  if (n <= 1) {
    return 1
  }
  return n * factorial(n - 1)
}

fn processArray(arr) {
  let result = []
  for (item in arr) {
    if (item > 5) {
      result = push(result, item * 2)
    }
  }
  return result
}

fn fibonacci(n) {
  let a = 0
  let b = 1
  let i = 0
  while (i < n) {
    let temp = a + b
    a = b
    b = temp
    i = i + 1
  }
  return a
}
```

## Functional Programming with Pipes

```gspl
// Using pipes for functional composition
let numbers = [1, 2, 3, 4, 5]

// Traditional nested calls:
let result1 = filter(map(numbers, x => x * 2), x > 5)

// Using pipes (more readable):
let result2 = numbers
  |> map(x => x * 2)
  |> filter(x => x > 5)
```

## Seed Breeding

```gspl
seed Creature {
  domain: game
  genes: {
    health: scalar = 100, min: 10, max: 200
    speed: scalar = 50, min: 20, max: 100
    strength: scalar = 50, min: 10, max: 100
    agility: scalar = 50, min: 10, max: 100
  }
}

let parent1 = Creature
let parent2 = mutate(Creature, rate: 0.2, intensity: 0.3)

// Uniform crossover (each gene randomly from either parent)
let child1 = breed(parent1, parent2, strategy: "uniform")

// One-point crossover (genetic algorithm style)
let child2 = breed(parent1, parent2, strategy: "onepoint")

// Two-point crossover
let child3 = breed(parent1, parent2, strategy: "twopoint")

// With dominance weighting
let child4 = breed(parent1, parent2, dominance: 0.7)
```

## Mutation and Evolution

```gspl
seed Plant {
  domain: procedural
  genes: {
    trunkThickness: scalar = 1.0, min: 0.5, max: 3.0
    branchAngle: scalar = 45, min: 20, max: 80
    maxDepth: scalar = 5, min: 2, max: 10
    color: categorical = "green", options: ["green", "brown", "gold"]
  }
}

// Light mutation (small changes)
let mutant1 = mutate(Plant, rate: 0.1, intensity: 0.2)

// Heavy mutation (large changes)
let mutant2 = mutate(Plant, rate: 0.5, intensity: 0.8)

// Evolution loop (basic population search)
let evolved = evolve(Plant, population: 50, generations: 20)
```

## Composition (Layer Merging)

```gspl
seed UIElement {
  domain: ui
  genes: {
    backgroundColor: categorical = "white"
    textColor: categorical = "black"
    borderRadius: scalar = 0, min: 0, max: 50
    padding: scalar = 10, min: 0, max: 50
  }
}

let baseStyle = UIElement
let darkTheme = {
  backgroundColor: "black",
  textColor: "white"
}

let roundedStyle = mutate(baseStyle, rate: 0.3)

// Compose base with rounded style
let composedUI = compose(baseStyle, roundedStyle)
```

## Complex Workflow

```gspl
// Define multiple seed types
seed Particle {
  domain: simulation
  genes: {
    x: scalar = 0, min: -100, max: 100
    y: scalar = 0, min: -100, max: 100
    vx: scalar = 0, min: -10, max: 10
    vy: scalar = 0, min: -10, max: 10
    mass: scalar = 1, min: 0.1, max: 10
  }
}

seed EmitterConfig {
  domain: simulation
  genes: {
    emissionRate: scalar = 10, min: 1, max: 100
    burstSize: scalar = 5, min: 1, max: 50
    lifetime: scalar = 5, min: 1, max: 30
  }
}

// Utility functions
fn applyGravity(particle, gravity) {
  return mutate(particle, rate: 1.0, intensity: gravity)
}

fn createVariation(seed, variation) {
  let base = seed
  let varied = mutate(base, rate: 0.5, intensity: variation)
  return breed(base, varied, dominance: 0.5)
}

// Create a population of variations
fn createPopulation(seed, size, variation) {
  let population = []
  let i = 0
  while (i < size) {
    let member = createVariation(seed, variation)
    population = push(population, member)
    i = i + 1
  }
  return population
}

// Usage
let baseParticle = Particle
let population = createPopulation(baseParticle, 100, 0.2)

// Evolve the population
let evolved = evolve(baseParticle, population: 100, generations: 50)
```

## Conditional Evolution

```gspl
fn shouldEvolveIntensity(generation) {
  if (generation < 10) {
    return 0.1  // Light changes early
  }
  if (generation < 30) {
    return 0.3  // Medium changes mid-way
  }
  return 0.5    // Strong changes late
}

seed AdaptiveOrganism {
  domain: simulation
  genes: {
    energy: scalar = 100, min: 50, max: 200
    size: scalar = 50, min: 20, max: 100
    reproduction: scalar = 0.5, min: 0.1, max: 1.0
  }
}

let organism = AdaptiveOrganism
let gen = 0

while (gen < 100) {
  let intensity = shouldEvolveIntensity(gen)
  organism = mutate(organism, rate: 0.3, intensity: intensity)
  gen = gen + 1
}
```

## Array and String Operations

```gspl
fn processNames(names) {
  let processed = []
  for (name in names) {
    let upper = toUpper(name)
    let trimmed = trim(upper)
    processed = push(processed, trimmed)
  }
  return processed
}

fn findLongest(words) {
  return reduce(words, (acc, word) => {
    let len = length(word)
    let accLen = length(acc)
    return len > accLen ? word : acc
  }, "")
}

let myList = ["apple", "banana", "cherry"]
let processed = processNames(myList)
let longest = findLongest(processed)
```

## Advanced Gene Composition

```gspl
seed VisualAsset {
  domain: visual2d
  genes: {
    // Position
    x: scalar = 0, min: -1000, max: 1000
    y: scalar = 0, min: -1000, max: 1000

    // Scale
    scaleX: scalar = 1, min: 0.1, max: 5
    scaleY: scalar = 1, min: 0.1, max: 5

    // Rotation
    rotation: scalar = 0, min: 0, max: 360

    // Color
    r: scalar = 255, min: 0, max: 255
    g: scalar = 255, min: 0, max: 255
    b: scalar = 255, min: 0, max: 255

    // Style
    opacity: scalar = 1, min: 0, max: 1
    blendMode: categorical = "normal", options: ["normal", "multiply", "screen", "overlay"]
  }
}

// Create variations
let red = mutate(VisualAsset, rate: 0.3, intensity: 0.5)
let scaled = mutate(VisualAsset, rate: 0.2, intensity: 0.3)

// Breed for balanced variation
let balanced = breed(red, scaled, dominance: 0.5)

// Compose layers
let final = compose(VisualAsset, balanced)
```

## Notes

- All numeric operations use IEEE 754 floating point
- String operations use JavaScript semantics
- Arrays are 0-indexed
- Object property access supports dot notation: `obj.property`
- Array access uses bracket notation: `arr[0]`
- Comments use `//` for single line and `/* */` for multi-line
- Statements can end with `;` or newline (semicolons optional)
- All functions return their last expression value
