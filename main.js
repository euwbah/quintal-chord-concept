// jshint esversion: 6

// Script order: 3

let $notes = {};

// Note modelling -- so that the appropriate enharmonic is used
let mNotes = {};

let dimens = {};

$(() => {
  $notes[1] = $notes.c = $('#note1');
  $notes[2] = $notes.cs = $('#note2');
  $notes[3] = $notes.d = $('#note3');
  $notes[4] = $notes.ds = $('#note4');
  $notes[5] = $notes.e = $('#note5');
  $notes[6] = $notes.f = $('#note6');
  $notes[7] = $notes.fs = $('#note7');
  $notes[8] = $notes.g = $('#note8');
  $notes[9] = $notes.gs = $('#note9');
  $notes[10] = $notes.a = $('#note10');
  $notes[11] = $notes.as = $('#note11');
  $notes[12] = $notes.b = $('#note12');

  adjustCircleContainerSize();

  assignDimensions();
  positionCircle();

  // Initialize circle with C as root note
  positionCircleNotes(new Note('c'));

  $('.note').css({opacity: 1});

  // When note is clicked, make it the new root
  $('.note').click(function() {
    $note = $(this);
    positionCircleNotes(new Note($note.text()));
  });
});

function assignDimensions() {
  let containerWidth = $('.circle-container').width();
  let containerHeight = $('.circle-container').height();

  let containerSquareEdgeLength =
      (containerWidth < containerHeight ? containerWidth : containerHeight);
  let diameter = containerSquareEdgeLength * 0.75;

  let originX = containerWidth / 2.0;
  let originY = containerHeight / 2.0;

  let radius = diameter / 2;

  let top = originY - radius;
  let bottom = originY + radius;
  let left = originX - radius;
  let right = originX + radius;

  dimens = {
    containerWidth, containerHeight, containerSquareEdgeLength,
    originX, originY,
    radius, diameter,
    top, bottom, left, right
  };
}

function adjustCircleContainerSize() {
  let $c = $('.circle-container');
  if ($c.height() > $c.width()) {
    console.log('adjusted');
    $c.height($c.width());
  }
}

function positionCircle() {
  $('#sectors').css({
    width: dimens.containerSquareEdgeLength,
    height: dimens.containerSquareEdgeLength
  });
  $('#inner-circle').css({
    width: dimens.containerSquareEdgeLength,
    height: dimens.containerSquareEdgeLength
  })
}

function positionCircleNotes(note) {
  let noteNo = note.pitch;
  let circleOfFifths = createCircleOfFifths(note); // note that this array is 1-based

  for(let i = 0; i < 12; i++) {
    let $note = $notes[noteNo];

    // Set text to the correct spelling
    // note that the text should be set first before positioning, as the text
    // affects $note.width() and .height()!
    $note.text(circleOfFifths[i + 1].toString());


    let top = dimens.originY - dimens.radius * Math.cos(2 * i / 12.0 * Math.PI) - $note.height() / 2;
    let left = dimens.originX + dimens.radius * Math.sin(2 * i / 12.0 * Math.PI) - $note.width() / 2;
    $note.css({top, left});


    noteNo = ring(noteNo + 7);
  }
}

// Creates the circle of fifths by going 6 fifths above the root and 5 fifths below.
// Returns a 1-based index array in the order of the circle of fifths.
// e.g. for C initial note: 1 => C, 2 => G, etc...
function createCircleOfFifths(initialNote, accidentalMode=AccidentalMode.ALLOW_ENHARMONICS) {
  let circleOfFifths = [];
  let n = initialNote.toConventionalSpelling();
  // root + 6 fifths
  for (let i = 1; i <= 7; i++) {
    circleOfFifths[i] = n;
    n = n.getInterval('5', accidentalMode);
  }

  n = initialNote.toConventionalSpelling();
  // root - 5 fifths
  for (let i = 12; i >= 8; i--) {
    n = n.getInterval('4', accidentalMode);
    circleOfFifths[i] = n;
  }

  return circleOfFifths;
}
