class AddDepArrToSchedule < ActiveRecord::Migration[5.2]
  def change
    add_column :schedules, :depArr, :integer
  end
end
