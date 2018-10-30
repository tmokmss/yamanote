class ScheduleEntry
  def initialize(time, station, direction, trainId, dayType, depArr)
    @time = time
    @station = station
    @direction = direction
    @trainId = trainId
    @dayType = dayType
    @depArr = depArr
  end

  def time
    @time
  end

  def station
    @station
  end

  def direction
    @direction
  end

  def trainId
    @trainId
  end

  def dayType
    @dayType
  end

  def depArr
    @depArr
  end
end