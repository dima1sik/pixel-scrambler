# Mini 2 - Image Scrambling

Educational project about digital image transformation.

## Project Goal

The goal of this project is to build an application that demonstrates several stages of image scrambling and unscrambling.  
This project is not intended to be a secure encryption system, but an educational experiment.

## Implemented Stages

### Stage 1 - Naive scrambling
- przesuniecia wierszy i kolumn,
- full reversibility with the correct key,
- clear security limitations.

### Stage 2 - Pure permutation
- permutacja pikseli sterowana seedem,
- osobna permutacja odwrotna,
- correct image restoration with the proper key.

### Stage 3 - Enhanced version
- permutacja pikseli,
- dodatkowa odwracalna substytucja wartosci RGB,
- correct image restoration with the proper key.

## Application Features

- loading PNG / JPEG / BMP images,
- stage selection: 1 / 2 / 3,
- using correct and wrong keys,
- przyciski Scramble i Unscramble,
- separate unscrambling test with a wrong key,
- wyswietlanie:
  - original image,
  - scrambled image,
  - restored image,
  - difference image,
- saving results to PNG files,
- basic analytical metrics.

## Metrics

The application calculates:
- korelacje pozioma pikseli dla original image,
- horizontal pixel correlation for the scrambled image,
- MSE dla porownania restored vs original,
- informacje, czy restored jest dokladnie rowny original.

## Technologie

- HTML
- CSS
- JavaScript
- Canvas API

## How to Run

1. Open the project folder in Visual Studio Code.
2. Run index.html using Live Server.
3. Load an image.
4. Select a stage and a key.
5. Use the Scramble, Unscramble, or Unscramble (wrong key) buttons.

## Uwagi

This is an educational project.  
The goal was to demonstrate the difference between simple scrambling, pure permutation, and an enhanced version, as well as to analyze the limitations of this approach.






