// jshint esversion: 6

// Script order: 2

// Mapping white key tonal centers to major scale accidentals
//
// Only the white keys are needed, because any accidentals on the
// key center itself will add/subtract the accidentals of every
// degree. e.g. F# major is just F major with all the degrees + 1
//
// (of course, there's a non-brute-force way to do this, but
// performance > memory, so screw that)
const PITCHNAME_SCALE_PATTERN = Object.freeze({
  // note the `undefined` which makes the index match the 1-based degrees.
  //
  // degrees:    1   2   3   4   5   6   7
  C: [undefined, 0,  0,  0,  0,  0,  0,  0],
  D: [undefined, 0,  0,  1,  0,  0,  0,  1],
  E: [undefined, 0,  1,  1,  0,  0,  1,  1],
  F: [undefined, 0,  0,  0, -1,  0,  0,  0],
  G: [undefined, 0,  0,  0,  0,  0,  0,  1],
  A: [undefined, 0,  0,  1,  0,  0,  1,  1],
  B: [undefined, 0,  1,  1,  0,  1,  1,  1]
});

// Mapping pitchname to pitch
const PITCHNAME_PITCH_MAP = Object.freeze({
  C: 1,
  D: 3,
  E: 5,
  F: 6,
  G: 8,
  A: 10,
  B: 12
});

const PITCHNAME_DEGREE_MAP = Object.freeze({
  C: 1,
  D: 2,
  E: 3,
  F: 4,
  G: 5,
  A: 6,
  B: 7
});

const DEGREE_PITCHNAME_MAP = Object.freeze({
  1: 'C',
  2: 'D',
  3: 'E',
  4: 'F',
  5: 'G',
  6: 'A',
  7: 'B'
});

const AccidentalMode = Object.freeze({
  // No Fb/E#B#/Cb
  BASIC: 0,
  // Has Fb/E#/B#/Cb
  ALLOW_ENHARMONICS: 1,
  // Has double accidentals if necessary
  ALLOW_DOUBLE_ACCIDENTALS: 2
});

class Note {
  // overloads:
  // (x: full note name) =>
  //    Creates the note as specified by x
  // (x: number from 1 to 12, y: 'b'/'#'/'auto') =>
  //    Create a note as specified by x where 1-12 maps to notes from C to B chromatically
  //    y denotes the appropriate enharmonic to use for black-keys
  //    if 'auto', the accidentals will follow conventional meantone spellings with C as the root,
  //    preferring 'F#' over 'Gb'
  // (x: number from 1 to 7 or note letter, y: accidental class from -2 to 2) =>
  //    pitchName will be assigned to x, accidentalClass and accidental will be assigned to y correspondingly

  // javascript sucks
  constructor(x, y) {
    if (typeof y === 'undefined') {
      // (x: note name)

      x = x.trim();

      this.pitchName = x[0].toUpperCase();
      this.accidental = x.substring(1).toLowerCase();
      this.accidentalClass = toAccidentalClass(this.accidental);
    } else if (typeof y === 'string'){

      // (x: 1-12 chromatic, y: 'b'/'#'/'auto')

      let pitchName, accidental, accidentalClass;
      if (y === 'auto')
        ({pitchName, accidental, accidentalClass} = CONVENTIONAL_PITCH_NOTE_MAP[x]);
      else
        ({pitchName, accidental, accidentalClass} = PITCH_NOTE_MAP[x][y === '#' ? 0 : 1]);

      this.pitchName = pitchName;
      this.accidental = accidental;
      this.accidentalClass = accidentalClass;
    } else {

      // (x: 1-7 or C-B diatonic, y: -2 to 2 representing bb to x accidentals)

      let pitchName = x;
      if (typeof pitchName === 'number')
        pitchName = DEGREE_PITCHNAME_MAP[x];

      this.pitchName = pitchName;
      this.accidentalClass = y;
      this.accidental = toAccidental(this.accidentalClass);
    }
  }

  // interval is numeric like "#4", "9" or "b13"
  // accidentalMode is one of the values of the AccidentalMode enumeration
  // to limit how crazy the accidentals can be. For the most accurate and
  // theoretically correct notes, use AccidentalMode.ALLOW_DOUBLE_ACCIDENTALS
  // Defaults to AccidentalMode.ALLOW_ENHARMONICS.
  //
  // Note that once the accidentals exceed the constraints defined by the
  // accidental mode, the new accidental will default to AccidentalMode.BASIC
  getInterval(interval, accidentalMode=AccidentalMode.ALLOW_ENHARMONICS) {
    // Step 0: parse interval string
    let [ , iAccidental, iDegree] = interval.match(/(\D*)(\d+)/);
    iDegree = Number.parseInt(iDegree);

    // Step 1: Perform a basic ring of 7 white keys
    // e.g. the ninth of B is also a second.
    let mDegree = PITCHNAME_DEGREE_MAP[this.pitchName];
    let newDegree = ring(mDegree + iDegree - 1, 7); // note the -1 because intervals are 1-based (1 = unison)

    // Step 2: Handle the accidentals
    // First the global tonal center accidental, which applies to everything
    let newAccidental = this.accidentalClass;

    // Next, apply the diatonic modal scalar accidentals
    newAccidental += PITCHNAME_SCALE_PATTERN[this.pitchName][iDegree];

    // Finally, apply the accidentals specified in the interval
    newAccidental += toAccidentalClass(iAccidental);

    // Step 3: Make sure the accidentals still follow constraints of the accidentalMode
    let basicPitch;
    if (accidentalMode === AccidentalMode.ALLOW_DOUBLE_ACCIDENTALS) {
      if (Math.abs(newAccidental) > 2) {
        // Can't have triple/quadruple sharp/flat...
        basicPitch = simplifyEnharmonicToPitchValue(newDegree, newAccidental);
      }
    } else if (accidentalMode === AccidentalMode.ALLOW_ENHARMONICS) {
      if (Math.abs(newAccidental) >= 2) {
        // Can't have double flats
        basicPitch = simplifyEnharmonicToPitchValue(newDegree, newAccidental);
      }
    } else if (accidentalMode === AccidentalMode.BASIC) {
      if (Math.abs(newAccidental) > 2 ||
          (newDegree === 7 || newDegree === 3) && newAccidental === 1 || // B# and E#
          (newDegree === 1 || newDegree === 4) && newAccidental === -1) {// Cb and Fb
        // Can't have triple/quadruple sharp/flat...
        basicPitch = simplifyEnharmonicToPitchValue(newDegree, newAccidental);
      }
    }

    if (basicPitch)
      return new Note(basicPitch, newAccidental < 0 ? 'b' : '#');
    else
      return new Note(newDegree, newAccidental);
  }

  get pitch() {
    return ring(PITCHNAME_PITCH_MAP[this.pitchName] + this.accidentalClass);
  }

  // Conventionally spelt notes are correctly enharmonically spelt notes for
  // the 12-tone meantone temperament, aka the notes used to name the
  // 12 major scales: C, G, D, A, E, B, F#/Gb, Db, Ab, Eb, Bb, F
  //
  // Note that for the tritone of C, both F# and Gb are proper spellings
  // as they are directly opposite C in the circle (6 fifths forward/backward)
  get isConventionallySpelt() {
    let currNote = this.toString();
    let matches =
      ['C', 'G', 'D', 'A', 'E', 'B', 'F#',
       'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F'].filter(x => x === currNote);

    return matches.length !== 0;
  }

  // Creates a new Note object representing this note, but enforces
  // conventional spelling as defined in the `isConventionallySpelt` getter property.
  toConventionalSpelling() {
    // Note that this if check is necessary to preserve the F#-Gb note spelling
    // as both are legitimate meantone spellings
    if(this.isConventionallySpelt)
      return new Note(this.toString());

    return new Note(this.pitch, 'auto');
  }

  toString() {
    return this.pitchName + this.accidental;
  }
}


// Basic pitch to note mapping
// Each pitch is mapped to a duplet, the first value represents
// the note if the # accidental is preferred, and the second if the
// b accidental is preferred instead.
const PITCH_NOTE_MAP = Object.freeze({
  1: [new Note('c'), new Note('c')],
  2: [new Note('c#'), new Note('db')],
  3: [new Note('d'), new Note('d')],
  4: [new Note('d#'), new Note('eb')],
  5: [new Note('e'), new Note('e')],
  6: [new Note('f'), new Note('f')],
  7: [new Note('f#'), new Note('gb')],
  8: [new Note('g'), new Note('g')],
  9: [new Note('g#'), new Note('ab')],
  10: [new Note('a'), new Note('a')],
  11: [new Note('a#'), new Note('bb')],
  12: [new Note('b'), new Note('b')]
});

const CONVENTIONAL_PITCH_NOTE_MAP = Object.freeze({
  1: new Note('c'),
  2: new Note('db'),
  3: new Note('d'),
  4: new Note('eb'),
  5: new Note('e'),
  6: new Note('f'),
  7: new Note('f#'),
  8: new Note('g'),
  9: new Note('ab'),
  10: new Note('a'),
  11: new Note('bb'),
  12: new Note('b')
});

// Converts an accidental string to a number representing the accidental
// 0 => natural
// 1 => sharp
// 2 => double sharp
// -1 => flat
// -2 => double flat
function toAccidentalClass(accidentalStr) {
  switch(accidentalStr) {
    case '':
      return 0;
    case '#':
      return 1;
    case 'x':
      return 2;
    case 'b':
      return -1;
    case 'bb':
      return -2;

  }
}

function toAccidental(accidentalClass) {
  switch(accidentalClass) {
    case -2: return 'bb';
    case -1: return 'b';
    case 0: return '';
    case 1: return '#';
    case 2: return 'x';
  }
}

// Just for this function, accidentalClass may be any integer,
// all it does is offset the degree chromatically
// Note that degree is always w.r.t C = 1
function simplifyEnharmonicToPitchValue(degree, accidentalClass) {
  let pitchname = DEGREE_PITCHNAME_MAP[degree];
  let pitch = PITCHNAME_PITCH_MAP[pitchname];
  pitch += accidentalClass;
  pitch = ring(pitch);
  return pitch;
}

// Wraps numbers in a one-based ring (lowest number is 1, highest number is bounds)
// e.g. if bounds = 12: 0 => 12, 1 => 1, 12 => 12, 13 => 1, 14 => 2, etc...
function ring(n, bounds=12) {
  let x = (n - 1) % bounds + 1;
  if (x <= 0)
    x = bounds + x;

  return x;
}
