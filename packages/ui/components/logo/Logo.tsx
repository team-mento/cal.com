import classNames from "@calcom/lib/classNames";
import { LOGO, LOGO_ICON } from "@calcom/lib/constants";

export default function Logo({
  small,
  icon,
  inline = true,
  className,
}: {
  small?: boolean;
  icon?: boolean;
  inline?: boolean;
  className?: string;
}) {
  return (
    <h3 className={classNames("logo", inline && "inline", className)}>
      <strong>
        {icon ? (
          <img className="mx-auto w-14" alt="Mento" title="Mento" src={LOGO_ICON} />
        ) : (
          <img className={small ? "h-8 w-auto" : "h-12 w-auto"} alt="Mento" title="Mento" src={LOGO} />
        )}
      </strong>
    </h3>
  );
}
