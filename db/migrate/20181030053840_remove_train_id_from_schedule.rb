class RemoveTrainIdFromSchedule < ActiveRecord::Migration[5.2]
  def change
    change_column :schedules, :trainId, :string
  end
end
