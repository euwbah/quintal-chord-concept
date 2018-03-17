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
  positionSectors();

  // Initialize circle with C as root note
  positionCircle(1);

  $('.note').css({opacity: 1});

  // When note is clicked, make it the new root
  $('.note').click(function() {
    $note = $(this);
    let noteNo = $note.data('note');
    positionCircle(noteNo);
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

function positionSectors() {
  $('.sector').css({
    width: dimens.containerSquareEdgeLength,
    height: dimens.containerSquareEdgeLength,
    borderRadius: '50%'
  });
}

function positionCircle(startingNoteNumber) {
  let noteNo = startingNoteNumber;
  for(let i = 0; i < 12; i++) {
    let $note = $notes[noteNo];
    let top = dimens.originY - dimens.radius * Math.cos(2 * i / 12.0 * Math.PI) - $note.height() / 2;
    let left = dimens.originX + dimens.radius * Math.sin(2 * i / 12.0 * Math.PI) - $note.width() / 2;
    $note.css({top, left});

    noteNo = ring(noteNo + 7);
  }
}

// Creates the circle of fifths by going 6 fifths above the root and 5 fifths below.
function createCircleOfFifths(initialNote, accidentalMode) {
  
}
