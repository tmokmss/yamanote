require_relative  './concerns/batch_processor'
require_relative './concerns/schedule_types'

class ScrapeEkitanJob < ApplicationJob
  queue_as :default
  @@working = false

  def perform(*args)
    return if @@working

    @@working = true
    yamanote_base = 'http://ekikara.jp/newdata/line/1301041/'
    schedules = []

    weekdayUp = BatchProcessor.new(yamanote_base, DirectionType::Up, '1_1', DayType::Weekday)
    # weekdayUp.process()

    weekdayUp.merge.each do |entry|
      schedules << makeDBEntry(entry)
    end

    weekdayDown = BatchProcessor.new(yamanote_base, DirectionType::Down, '1_1', DayType::Weekday)
    # weekdayDown.process()

    weekdayDown.merge.each do |entry|
      schedules << makeDBEntry(entry)
    end

    saturdayUp = BatchProcessor.new(yamanote_base, DirectionType::Up, '1_1', DayType::Saturday)
    saturdayDown = BatchProcessor.new(yamanote_base, DirectionType::Down, '1_1', DayType::Saturday)
    holidayUp = BatchProcessor.new(yamanote_base, DirectionType::Up, '1_1', DayType::Holiday)
    holidayDown = BatchProcessor.new(yamanote_base, DirectionType::Down, '1_1', DayType::Holiday)

    Schedule.import(schedules)
    @@working = false
  end

  private
  def makeDBEntry(entry)
    schedule = Schedule.new
    schedule.station = entry.station
    schedule.time = entry.time
    schedule.direction = entry.direction
    schedule.trainId = entry.trainId
    schedule.dayType = entry.dayType
    schedule.depArr = entry.depArr
    return schedule
  end
end
