import os
import pytest
from backend.app.sources.file_source import FileSource


def test_file_source_missing_file_raises():
    source = FileSource("samples/non_existent_video.mp4")
    with pytest.raises(FileNotFoundError) as exc_info:
        source.open()
    assert "does not exist" in str(exc_info.value)


def test_file_source_reads_and_loops():
    # Uses actual samples/dummy.mp4
    video_path = "samples/dummy.mp4"
    if not os.path.exists(video_path):
        pytest.skip(f"{video_path} not found")

    source = FileSource(video_path)
    source.open()
    assert source.fps > 0
    assert not source.is_live

    # Read first 5 frames
    frames = []
    timestamps = []
    for _ in range(5):
        frame, ts = source.read()
        assert frame is not None
        assert frame.shape[0] > 0
        assert frame.shape[1] > 0
        frames.append(frame)
        timestamps.append(ts)

    # Timestamps must be monotonic
    for i in range(1, len(timestamps)):
        assert timestamps[i] > timestamps[i - 1]

    # Test looping: seek near end and verify read continues seamlessly
    if source._cap is not None and source._total_frames > 2:
        source._cap.set(1, source._total_frames - 1)  # Set to last frame
        frame_last, ts_last = source.read()
        assert frame_last is not None

        # Next read triggers loop rewind
        frame_next, ts_next = source.read()
        assert frame_next is not None
        assert ts_next > ts_last  # Continuous monotonic time across loops
        assert source._loop_count >= 1

    source.close()

